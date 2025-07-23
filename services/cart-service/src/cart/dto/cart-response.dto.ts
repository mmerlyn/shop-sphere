import { Exclude, Expose, Transform } from 'class-transformer';

export class CartItemResponseDto {
  @Expose()
  productId: string;

  @Expose()
  variantId?: string;

  @Expose()
  quantity: number;

  @Expose()
  @Transform(({ value }) => parseFloat(value || 0).toFixed(2))
  unitPrice: string;

  @Expose()
  @Transform(({ value }) => parseFloat(value || 0).toFixed(2))
  totalPrice: string;

  @Expose()
  productName: string;

  @Expose()
  productSku?: string;

  @Expose()
  productImage?: string;

  @Expose()
  category?: string;

  @Expose()
  brand?: string;

  @Expose()
  addedAt: Date;

  @Expose()
  updatedAt: Date;

  @Expose()
  isInStock: boolean;

  @Expose()
  availableQuantity?: number;
}

export class CartResponseDto {
  @Expose()
  id: string;

  @Expose()
  @Exclude()
  userId?: string;

  @Expose()
  @Exclude()
  sessionId?: string;

  @Expose()
  items: CartItemResponseDto[];

  @Expose()
  itemCount: number;

  @Expose()
  @Transform(({ value }) => parseFloat(value || 0).toFixed(2))
  subtotal: string;

  @Expose()
  @Transform(({ value }) => parseFloat(value || 0).toFixed(2))
  taxAmount: string;

  @Expose()
  @Transform(({ value }) => parseFloat(value || 0).toFixed(2))
  discountAmount: string;

  @Expose()
  @Transform(({ value }) => parseFloat(value || 0).toFixed(2))
  shippingAmount: string;

  @Expose()
  @Transform(({ value }) => parseFloat(value || 0).toFixed(2))
  totalAmount: string;

  @Expose()
  currency: string;

  @Expose()
  couponCode?: string;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;

  @Expose()
  lastActivity: Date;

  @Expose()
  expiresAt?: Date;

  @Expose()
  isExpired: boolean;

  @Expose()
  isEmpty: boolean;
}

export class CartSummaryDto {
  @Expose()
  itemCount: number;

  @Expose()
  @Transform(({ value }) => parseFloat(value || 0).toFixed(2))
  totalAmount: string;

  @Expose()
  currency: string;

  constructor(cart: any) {
    this.itemCount = cart.itemCount;
    this.totalAmount = parseFloat(cart.totalAmount || 0).toFixed(2);
    this.currency = cart.currency;
  }
}