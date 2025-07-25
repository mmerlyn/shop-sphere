import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

export interface CartItem {
  productId: string;
  variantId?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  productName: string;
  productImage?: string;
  brand?: string;
  category?: string;
  productSlug?: string;
  productSku?: string;
  variantName?: string;
  attributes?: Record<string, string>;
}

export interface Cart {
  id: string;
  userId?: string;
  sessionId?: string;
  items: CartItem[];
  subtotal: number;
  taxAmount: number;
  shippingCost: number;
  discountAmount: number;
  totalAmount: number;
  couponCode?: string;
  couponDiscount?: number;
  updatedAt: Date;
}

export interface CouponValidation {
  valid: boolean;
  discountAmount: number;
  discountType?: 'percentage' | 'fixed';
  message?: string;
}

@Injectable()
export class CartService {
  private readonly logger = new Logger(CartService.name);
  private readonly cartServiceUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.cartServiceUrl = this.configService.get<string>('CART_SERVICE_URL', 'http://cart-service:3003');
  }

  async getCartByUserId(userId: string): Promise<Cart | null> {
    try {
      this.logger.debug(`Fetching cart for user: ${userId}`);
      
      const response = await firstValueFrom(
        this.httpService.get(`${this.cartServiceUrl}/api/v1/cart/user/${userId}`, {
          timeout: 5000,
        }),
      );
      
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to fetch cart for user ${userId}:`, error.message);
      return null;
    }
  }

  async getCartBySessionId(sessionId: string): Promise<Cart | null> {
    try {
      this.logger.debug(`Fetching cart for session: ${sessionId}`);
      
      const response = await firstValueFrom(
        this.httpService.get(`${this.cartServiceUrl}/api/v1/cart/session/${sessionId}`, {
          timeout: 5000,
        }),
      );
      
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to fetch cart for session ${sessionId}:`, error.message);
      return null;
    }
  }

  async clearCart(userId?: string, sessionId?: string): Promise<boolean> {
    try {
      if (userId) {
        this.logger.debug(`Clearing cart for user: ${userId}`);
        await firstValueFrom(
          this.httpService.delete(`${this.cartServiceUrl}/api/v1/cart/user/${userId}/clear`, {
            timeout: 5000,
          }),
        );
      } else if (sessionId) {
        this.logger.debug(`Clearing cart for session: ${sessionId}`);
        await firstValueFrom(
          this.httpService.delete(`${this.cartServiceUrl}/api/v1/cart/session/${sessionId}/clear`, {
            timeout: 5000,
          }),
        );
      }
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to clear cart:`, error.message);
      return false;
    }
  }

  async validateCoupon(couponCode: string, userId?: string, cartTotal?: number): Promise<CouponValidation> {
    try {
      this.logger.debug(`Validating coupon: ${couponCode}`);
      
      const response = await firstValueFrom(
        this.httpService.post(`${this.cartServiceUrl}/api/v1/cart/validate-coupon`, {
          couponCode,
          userId,
          cartTotal,
        }, {
          timeout: 5000,
        }),
      );
      
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to validate coupon ${couponCode}:`, error.message);
      return { valid: false, discountAmount: 0, message: 'Failed to validate coupon' };
    }
  }
}