import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';
import { AddItemDto, UpdateItemDto } from './dto';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

export interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
}

export interface Cart {
  id: string;
  userId?: string;
  items: CartItem[];
  subtotal: number;
  discount: number;
  total: number;
  couponCode?: string;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class CartService {
  private readonly logger = new Logger(CartService.name);
  private readonly cartTtl: number;
  private readonly productServiceUrl: string;

  constructor(
    private redisService: RedisService,
    private configService: ConfigService,
  ) {
    this.cartTtl = this.configService.get<number>('CART_TTL') || 604800; // 7 days
    this.productServiceUrl =
      this.configService.get<string>('PRODUCT_SERVICE_URL') || 'http://localhost:3002';
  }

  private getCartKey(cartId: string): string {
    return `cart:${cartId}`;
  }

  private getUserCartKey(userId: string): string {
    return `user_cart:${userId}`;
  }

  async createCart(userId?: string): Promise<Cart> {
    const cartId = uuidv4();
    const now = new Date().toISOString();

    const cart: Cart = {
      id: cartId,
      userId,
      items: [],
      subtotal: 0,
      discount: 0,
      total: 0,
      createdAt: now,
      updatedAt: now,
    };

    await this.saveCart(cart);

    if (userId) {
      await this.redisService.set(this.getUserCartKey(userId), cartId);
    }

    return cart;
  }

  async getCart(cartId: string): Promise<Cart> {
    const data = await this.redisService.get(this.getCartKey(cartId));

    if (!data) {
      throw new NotFoundException('Cart not found');
    }

    return JSON.parse(data);
  }

  async getCartByUserId(userId: string): Promise<Cart | null> {
    const cartId = await this.redisService.get(this.getUserCartKey(userId));

    if (!cartId) {
      return null;
    }

    try {
      return await this.getCart(cartId);
    } catch {
      return null;
    }
  }

  async getOrCreateCart(cartId?: string, userId?: string): Promise<Cart> {
    // If user is logged in, try to get their cart
    if (userId) {
      const userCart = await this.getCartByUserId(userId);
      if (userCart) {
        return userCart;
      }
    }

    // If cartId is provided, try to get that cart
    if (cartId) {
      try {
        const cart = await this.getCart(cartId);
        // If user just logged in, associate the cart with the user
        if (userId && !cart.userId) {
          cart.userId = userId;
          await this.saveCart(cart);
          await this.redisService.set(this.getUserCartKey(userId), cartId);
        }
        return cart;
      } catch {
        // Cart not found, create new one
      }
    }

    return this.createCart(userId);
  }

  async addItem(cartId: string, addItemDto: AddItemDto): Promise<Cart> {
    const cart = await this.getCart(cartId);
    const { productId, quantity } = addItemDto;

    // Fetch product details from Product Service
    const product = await this.fetchProduct(productId);

    if (!product) {
      throw new BadRequestException('Product not found');
    }

    if (product.inventory < quantity) {
      throw new BadRequestException('Insufficient inventory');
    }

    // Check if item already exists in cart
    const existingItemIndex = cart.items.findIndex(
      (item) => item.productId === productId,
    );

    if (existingItemIndex >= 0) {
      cart.items[existingItemIndex].quantity += quantity;
    } else {
      cart.items.push({
        productId,
        name: product.name,
        price: Number(product.price),
        quantity,
        image: product.images?.[0],
      });
    }

    this.recalculateTotals(cart);
    await this.saveCart(cart);

    return cart;
  }

  async updateItem(
    cartId: string,
    productId: string,
    updateItemDto: UpdateItemDto,
  ): Promise<Cart> {
    const cart = await this.getCart(cartId);
    const { quantity } = updateItemDto;

    const itemIndex = cart.items.findIndex(
      (item) => item.productId === productId,
    );

    if (itemIndex < 0) {
      throw new NotFoundException('Item not found in cart');
    }

    if (quantity === 0) {
      cart.items.splice(itemIndex, 1);
    } else {
      // Verify inventory
      const product = await this.fetchProduct(productId);
      if (product && product.inventory < quantity) {
        throw new BadRequestException('Insufficient inventory');
      }
      cart.items[itemIndex].quantity = quantity;
    }

    this.recalculateTotals(cart);
    await this.saveCart(cart);

    return cart;
  }

  async removeItem(cartId: string, productId: string): Promise<Cart> {
    const cart = await this.getCart(cartId);

    const itemIndex = cart.items.findIndex(
      (item) => item.productId === productId,
    );

    if (itemIndex < 0) {
      throw new NotFoundException('Item not found in cart');
    }

    cart.items.splice(itemIndex, 1);
    this.recalculateTotals(cart);
    await this.saveCart(cart);

    return cart;
  }

  async clearCart(cartId: string): Promise<Cart> {
    const cart = await this.getCart(cartId);

    cart.items = [];
    cart.couponCode = undefined;
    this.recalculateTotals(cart);
    await this.saveCart(cart);

    return cart;
  }

  async deleteCart(cartId: string): Promise<void> {
    const cart = await this.getCart(cartId);

    if (cart.userId) {
      await this.redisService.del(this.getUserCartKey(cart.userId));
    }

    await this.redisService.del(this.getCartKey(cartId));
  }

  async applyCoupon(cartId: string, code: string): Promise<Cart> {
    const cart = await this.getCart(cartId);

    // Simple coupon logic - in production, this would call a coupon service
    const discount = this.calculateCouponDiscount(code, cart.subtotal);

    if (discount === 0) {
      throw new BadRequestException('Invalid coupon code');
    }

    cart.couponCode = code;
    cart.discount = discount;
    cart.total = cart.subtotal - discount;
    await this.saveCart(cart);

    return cart;
  }

  async removeCoupon(cartId: string): Promise<Cart> {
    const cart = await this.getCart(cartId);

    cart.couponCode = undefined;
    cart.discount = 0;
    cart.total = cart.subtotal;
    await this.saveCart(cart);

    return cart;
  }

  async mergeGuestCart(guestCartId: string, userId: string): Promise<Cart> {
    const guestCart = await this.getCart(guestCartId);
    let userCart = await this.getCartByUserId(userId);

    if (!userCart) {
      // Convert guest cart to user cart
      guestCart.userId = userId;
      await this.saveCart(guestCart);
      await this.redisService.set(this.getUserCartKey(userId), guestCartId);
      return guestCart;
    }

    // Merge items from guest cart into user cart
    for (const guestItem of guestCart.items) {
      const existingIndex = userCart.items.findIndex(
        (item) => item.productId === guestItem.productId,
      );

      if (existingIndex >= 0) {
        userCart.items[existingIndex].quantity += guestItem.quantity;
      } else {
        userCart.items.push(guestItem);
      }
    }

    this.recalculateTotals(userCart);
    await this.saveCart(userCart);

    // Delete guest cart
    await this.redisService.del(this.getCartKey(guestCartId));

    return userCart;
  }

  private recalculateTotals(cart: Cart): void {
    cart.subtotal = cart.items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );
    cart.subtotal = Math.round(cart.subtotal * 100) / 100;

    if (cart.couponCode) {
      cart.discount = this.calculateCouponDiscount(cart.couponCode, cart.subtotal);
    }

    cart.total = Math.round((cart.subtotal - cart.discount) * 100) / 100;
    cart.updatedAt = new Date().toISOString();
  }

  private calculateCouponDiscount(code: string, subtotal: number): number {
    // Simple coupon logic for demo purposes
    const coupons: Record<string, { type: 'percent' | 'fixed'; value: number }> = {
      SAVE10: { type: 'percent', value: 10 },
      SAVE20: { type: 'percent', value: 20 },
      FLAT50: { type: 'fixed', value: 50 },
      FLAT100: { type: 'fixed', value: 100 },
    };

    const coupon = coupons[code.toUpperCase()];
    if (!coupon) return 0;

    if (coupon.type === 'percent') {
      return Math.round(subtotal * (coupon.value / 100) * 100) / 100;
    }

    return Math.min(coupon.value, subtotal);
  }

  private async saveCart(cart: Cart): Promise<void> {
    await this.redisService.set(
      this.getCartKey(cart.id),
      JSON.stringify(cart),
      this.cartTtl,
    );
  }

  private async fetchProduct(productId: string): Promise<any | null> {
    try {
      const response = await axios.get(
        `${this.productServiceUrl}/api/products/${productId}`,
      );
      return response.data;
    } catch (error) {
      this.logger.warn(`Failed to fetch product ${productId}`);
      return null;
    }
  }
}
