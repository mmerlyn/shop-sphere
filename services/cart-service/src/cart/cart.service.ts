import { Injectable, Logger, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { RedisService } from '../database/redis.service';
import { PrismaService } from '../database/prisma.service';
import { ProductService, ProductInfo } from './external/product/product.service';
import { UserService } from './external/user/user.service';
import { ConfigService } from '../config/config.service';
import { Cart } from './entities/cart.entity';
import { CartItem } from './entities/cart-item.entity';
import { 
  AddToCartDto, 
  UpdateCartItemDto, 
  RemoveCartItemDto,
  ApplyCouponDto,
  CartResponseDto 
} from './dto';
import { v4 as uuidv4 } from 'uuid';
import { plainToClass } from 'class-transformer';

@Injectable()
export class CartService {
  private readonly logger = new Logger(CartService.name);

  constructor(
    private readonly redisService: RedisService,
    private readonly prismaService: PrismaService,
    private readonly productService: ProductService,
    private readonly userService: UserService,
    private readonly configService: ConfigService,
  ) {}

  async getCart(userId?: string, sessionId?: string): Promise<CartResponseDto> {
    const cartId = await this.resolveCartId(userId, sessionId);
    
    if (!cartId) {
      const newCart = await this.createCart(userId, sessionId);
      return this.transformCartResponse(newCart);
    }

    const cartData = await this.redisService.getCart(cartId);
    
    if (!cartData) {
      const newCart = await this.createCart(userId, sessionId);
      return this.transformCartResponse(newCart);
    }

    const cart = new Cart(cartData);
    
    if (cart.isExpired()) {
      await this.deleteCart(cartId, userId);
      const newCart = await this.createCart(userId, sessionId);
      return this.transformCartResponse(newCart);
    }

    await this.validateCartItems(cart);
    
    cart.lastActivity = new Date();
    await this.saveCart(cart);

    return this.transformCartResponse(cart);
  }

  async getCartSummary(userId?: string, sessionId?: string): Promise<{ itemCount: number; totalAmount: string; currency: string }> {
    const cart = await this.getCart(userId, sessionId);
    return {
      itemCount: cart.itemCount,
      totalAmount: cart.totalAmount, 
      currency: cart.currency,
    };
  }

  async addToCart(addToCartDto: AddToCartDto, userId?: string, sessionId?: string): Promise<CartResponseDto> {
    const { productId, variantId, quantity, unitPrice } = addToCartDto;

    const productInfo = await this.getValidatedProduct(productId, variantId);

    const stockAvailable = await this.productService.checkStock(productId, variantId, quantity);
    if (!stockAvailable) {
      throw new BadRequestException('Insufficient stock available');
    }

    const cartId = await this.resolveCartId(userId, sessionId);
    let cart: Cart;

    if (cartId) {
      const cartData = await this.redisService.getCart(cartId);
      cart = cartData ? new Cart(cartData) : await this.createCart(userId, sessionId);
    } else {
      cart = await this.createCart(userId, sessionId);
    }

    if (cart.itemCount >= this.configService.cartConfig.maxItems) {
      throw new BadRequestException(`Cart cannot exceed ${this.configService.cartConfig.maxItems} items`);
    }

    const cartItem = new CartItem({
      productId,
      variantId,
      quantity,
      unitPrice: unitPrice || productInfo.price,
      productName: productInfo.name,
      productSku: productInfo.sku,
      productImage: productInfo.images?.[0],
      category: productInfo.category,
      brand: productInfo.brand,
      isInStock: productInfo.inStock,
      availableQuantity: productInfo.availableQuantity,
    });

    cart.addItem(cartItem);

    await this.saveCart(cart);

    await this.saveCartAnalytics(cart);

    this.logger.log(`Added item ${productId} to cart ${cart.id}`);

    return this.transformCartResponse(cart);
  }

  async updateCartItem(updateDto: UpdateCartItemDto, userId?: string, sessionId?: string): Promise<CartResponseDto> {
    const { productId, variantId, quantity } = updateDto;

    const cart = await this.getCartForModification(userId, sessionId);
    
    if (quantity > 0) {
      const stockAvailable = await this.productService.checkStock(productId, variantId, quantity);
      if (!stockAvailable) {
        throw new BadRequestException('Insufficient stock available for requested quantity');
      }
    }

    const updated = cart.updateItem(productId, variantId, quantity);
    
    if (!updated) {
      throw new NotFoundException('Cart item not found');
    }

    await this.saveCart(cart);
    await this.saveCartAnalytics(cart);

    this.logger.log(`Updated item ${productId} in cart ${cart.id} to quantity ${quantity}`);

    return this.transformCartResponse(cart);
  }

  async removeCartItem(removeDto: RemoveCartItemDto, userId?: string, sessionId?: string): Promise<CartResponseDto> {
    const { productId, variantId } = removeDto;

    const cart = await this.getCartForModification(userId, sessionId);
    
    const removed = cart.removeItem(productId, variantId);
    
    if (!removed) {
      throw new NotFoundException('Cart item not found');
    }

    await this.saveCart(cart);
    await this.saveCartAnalytics(cart);

    this.logger.log(`Removed item ${productId} from cart ${cart.id}`);

    return this.transformCartResponse(cart);
  }

  async clearCart(userId?: string, sessionId?: string): Promise<CartResponseDto> {
    const cart = await this.getCartForModification(userId, sessionId);
    
    cart.clear();
    
    await this.saveCart(cart);
    await this.saveCartAnalytics(cart);

    this.logger.log(`Cleared cart ${cart.id}`);

    return this.transformCartResponse(cart);
  }

  async applyCoupon(couponDto: ApplyCouponDto, userId?: string, sessionId?: string): Promise<CartResponseDto> {
    const { couponCode } = couponDto;

    const cart = await this.getCartForModification(userId, sessionId);
    
    if (cart.isEmpty()) {
      throw new BadRequestException('Cannot apply coupon to empty cart');
    }

    const isValidCoupon = await this.validateCoupon(couponCode, cart);
    
    if (!isValidCoupon) {
      throw new BadRequestException('Invalid or expired coupon code');
    }

    cart.couponCode = couponCode;
    cart.updateCalculations();

    await this.saveCart(cart);
    await this.saveCartAnalytics(cart);

    this.logger.log(`Applied coupon ${couponCode} to cart ${cart.id}`);

    return this.transformCartResponse(cart);
  }

  async removeCoupon(userId?: string, sessionId?: string): Promise<CartResponseDto> {
    const cart = await this.getCartForModification(userId, sessionId);
    
    cart.couponCode = undefined;
    cart.updateCalculations();

    await this.saveCart(cart);
    await this.saveCartAnalytics(cart);

    this.logger.log(`Removed coupon from cart ${cart.id}`);

    return this.transformCartResponse(cart);
  }

  async mergeGuestCart(guestSessionId: string, userId: string): Promise<CartResponseDto> {
    const guestCartId = await this.redisService.getSession(guestSessionId);
    const userCartId = await this.redisService.getUserCart(userId);

    let targetCart: Cart;
    let sourceCart: Cart | null = null;

    if (userCartId) {
      const userCartData = await this.redisService.getCart(userCartId);
      targetCart = userCartData ? new Cart(userCartData) : await this.createCart(userId);
    } else {
      targetCart = await this.createCart(userId);
    }

    if (guestCartId) {
      const guestCartData = await this.redisService.getCart(guestCartId);
      if (guestCartData) {
        sourceCart = new Cart(guestCartData);
      }
    }

    if (sourceCart && !sourceCart.isEmpty()) {
      for (const item of sourceCart.items) {
        const existingItem = targetCart.items.find(
          targetItem => targetItem.productId === item.productId && targetItem.variantId === item.variantId
        );

        if (existingItem) {
          const newQuantity = existingItem.quantity + item.quantity;
          const stockAvailable = await this.productService.checkStock(item.productId, item.variantId, newQuantity);
          
          if (stockAvailable) {
            existingItem.updateQuantity(newQuantity);
          } else {
            const maxStock = Math.min(existingItem.availableQuantity || 99, this.configService.cartConfig.maxItems);
            existingItem.updateQuantity(Math.min(newQuantity, maxStock));
          }
        } else {
          if (targetCart.itemCount < this.configService.cartConfig.maxItems) {
            targetCart.addItem(item);
          }
        }
      }

      await this.deleteCart(guestCartId);
      await this.redisService.deleteSession(guestSessionId);
    }

    await this.redisService.setUserCart(userId, targetCart.id);
    
    await this.saveCart(targetCart);
    await this.saveCartAnalytics(targetCart);

    this.logger.log(`Merged guest cart for session ${guestSessionId} with user cart ${targetCart.id}`);

    return this.transformCartResponse(targetCart);
  }

  async deleteCart(cartId: string, userId?: string): Promise<void> {
    await this.redisService.deleteCart(cartId);
    
    if (userId) {
      await this.redisService.deleteUserCart(userId);
    }

    this.logger.log(`Deleted cart ${cartId}`);
  }

  private async createCart(userId?: string, sessionId?: string): Promise<Cart> {
    const cartId = uuidv4();
    const now = new Date();
    const config = this.configService.cartConfig;
    
    const cart = new Cart({
      id: cartId,
      userId,
      sessionId,
      items: [],
      itemCount: 0,
      subtotal: 0,
      taxAmount: 0,
      discountAmount: 0,
      shippingAmount: 0,
      totalAmount: 0,
      currency: config.defaultCurrency,
      createdAt: now,
      updatedAt: now,
      lastActivity: now,
      expiresAt: userId 
        ? new Date(now.getTime() + config.userTtl * 1000)
        : new Date(now.getTime() + config.sessionTtl * 1000),
    });

    await this.saveCart(cart);

    if (userId) {
      await this.redisService.setUserCart(userId, cartId);
    }
    
    if (sessionId) {
      await this.redisService.setSession(sessionId, { cartId }, config.sessionTtl);
    }

    this.logger.log(`Created new cart ${cartId} for ${userId ? `user ${userId}` : `session ${sessionId}`}`);

    return cart;
  }

  private async saveCart(cart: Cart): Promise<void> {
    const config = this.configService.cartConfig;
    const ttl = cart.userId ? config.userTtl : config.sessionTtl;
    
    await this.redisService.setCart(cart.id, cart, ttl);
  }

  private async resolveCartId(userId?: string, sessionId?: string): Promise<string | null> {
    if (userId) {
      return await this.redisService.getUserCart(userId);
    }
    
    if (sessionId) {
      const sessionData = await this.redisService.getSession(sessionId);
      return sessionData?.cartId || null;
    }

    return null;
  }

  private async getCartForModification(userId?: string, sessionId?: string): Promise<Cart> {
    const cartId = await this.resolveCartId(userId, sessionId);
    
    if (!cartId) {
      throw new NotFoundException('Cart not found');
    }

    const cartData = await this.redisService.getCart(cartId);
    
    if (!cartData) {
      throw new NotFoundException('Cart not found');
    }

    const cart = new Cart(cartData);
    
    if (cart.isExpired()) {
      await this.deleteCart(cartId, userId);
      throw new NotFoundException('Cart has expired');
    }

    return cart;
  }

  private async getValidatedProduct(productId: string, variantId?: string): Promise<ProductInfo> {
    const product = await this.productService.getProduct(productId);
    
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (!product.inStock) {
      throw new BadRequestException('Product is not in stock');
    }

    if (variantId) {
      const variant = await this.productService.getVariant(productId, variantId);
      if (!variant) {
        throw new NotFoundException('Product variant not found');
      }
      if (!variant.inStock) {
        throw new BadRequestException('Product variant is not in stock');
      }
    }

    return product;
  }

  private async validateCartItems(cart: Cart): Promise<void> {
    const productIds = cart.items.map(item => item.productId);
    
    if (productIds.length === 0) return;

    try {
      const products = await this.productService.getProducts(productIds);
      const productMap = new Map(products.map(p => [p.id, p]));

      for (const item of cart.items) {
        const currentProduct = productMap.get(item.productId);
        
        if (!currentProduct) {
          cart.removeItem(item.productId, item.variantId);
          continue;
        }

        item.productName = currentProduct.name;
        item.unitPrice = currentProduct.price;
        item.isInStock = currentProduct.inStock;
        item.availableQuantity = currentProduct.availableQuantity;

        if (!item.isValidQuantity()) {
          if (item.availableQuantity && item.availableQuantity > 0) {
            item.updateQuantity(Math.min(item.quantity, item.availableQuantity));
          } else {
            cart.removeItem(item.productId, item.variantId);
          }
        }
      }

      cart.updateCalculations();
    } catch (error) {
      this.logger.warn(`Failed to validate cart items: ${error.message}`);
    }
  }

  private async validateCoupon(couponCode: string, cart: Cart): Promise<boolean> {
    const validCoupons = ['SAVE10', 'WELCOME15', 'FREESHIP'];
    
    if (!validCoupons.includes(couponCode)) {
      return false;
    }

    if (couponCode === 'FREESHIP' && cart.subtotal < 50) {
      return false; 
    }

    return true;
  }

  private async saveCartAnalytics(cart: Cart): Promise<void> {
    try {
      await this.prismaService.cartAnalytics.upsert({
        where: { cartId: cart.id },
        update: {
          itemCount: cart.itemCount,
          totalAmount: cart.totalAmount,
          currency: cart.currency,
          lastActivity: cart.lastActivity,
          isAbandoned: false,
        },
        create: {
          cartId: cart.id,
          userId: cart.userId,
          sessionId: cart.sessionId,
          itemCount: cart.itemCount,
          totalAmount: cart.totalAmount,
          currency: cart.currency,
          lastActivity: cart.lastActivity,
        },
      });
    } catch (error) {
      this.logger.warn(`Failed to save cart analytics: ${error.message}`);
    }
  }

  private transformCartResponse(cart: Cart): CartResponseDto {
    return plainToClass(CartResponseDto, {
      ...cart,
      isExpired: cart.isExpired(),
      isEmpty: cart.isEmpty(),
    }, { excludeExtraneousValues: true });
  }
}