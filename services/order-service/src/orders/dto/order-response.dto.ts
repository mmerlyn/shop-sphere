import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrderStatus, PaymentStatus } from '../enums';
import { AddressDto } from './create-order.dto';

export class OrderItemResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  productId: string;

  @ApiProperty()
  productName: string;

  @ApiPropertyOptional()
  productSku?: string;

  @ApiPropertyOptional()
  productSlug?: string;

  @ApiPropertyOptional()
  variantId?: string;

  @ApiPropertyOptional()
  variantName?: string;

  @ApiPropertyOptional()
  attributes?: Record<string, string>;

  @ApiProperty()
  unitPrice: number;

  @ApiProperty()
  quantity: number;

  @ApiProperty()
  totalPrice: number;

  @ApiPropertyOptional()
  productImage?: string;

  @ApiPropertyOptional()
  brand?: string;

  @ApiPropertyOptional()
  category?: string;
}

export class OrderStatusHistoryResponseDto {
  @ApiProperty()
  id: string;

  @ApiPropertyOptional()
  fromStatus?: OrderStatus;

  @ApiProperty({ enum: OrderStatus })
  toStatus: OrderStatus;

  @ApiPropertyOptional()
  reason?: string;

  @ApiPropertyOptional()
  notes?: string;

  @ApiPropertyOptional()
  changedBy?: string;

  @ApiProperty()
  changedByType: string;

  @ApiProperty()
  createdAt: Date;
}

export class OrderResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  orderNumber: string;

  @ApiPropertyOptional()
  userId?: string;

  @ApiProperty({ enum: OrderStatus })
  status: OrderStatus;

  @ApiProperty({ enum: PaymentStatus })
  paymentStatus: PaymentStatus;

  @ApiProperty()
  subtotal: number;

  @ApiProperty()
  taxAmount: number;

  @ApiProperty()
  shippingCost: number;

  @ApiProperty()
  discountAmount: number;

  @ApiProperty()
  totalAmount: number;

  @ApiPropertyOptional()
  paymentMethod?: string;

  @ApiPropertyOptional()
  paymentId?: string;

  @ApiProperty({ type: AddressDto })
  shippingAddress: AddressDto;

  @ApiProperty({ type: AddressDto })
  billingAddress: AddressDto;

  @ApiProperty()
  customerEmail: string;

  @ApiPropertyOptional()
  customerPhone?: string;

  @ApiPropertyOptional()
  couponCode?: string;

  @ApiPropertyOptional()
  couponDiscount?: number;

  @ApiPropertyOptional()
  trackingNumber?: string;

  @ApiPropertyOptional()
  shippedAt?: Date;

  @ApiPropertyOptional()
  deliveredAt?: Date;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ type: [OrderItemResponseDto] })
  items: OrderItemResponseDto[];

  @ApiPropertyOptional({ type: [OrderStatusHistoryResponseDto] })
  statusHistory?: OrderStatusHistoryResponseDto[];
}

export class OrderSummaryDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  orderNumber: string;

  @ApiProperty({ enum: OrderStatus })
  status: OrderStatus;

  @ApiProperty()
  totalAmount: number;

  @ApiProperty()
  itemCount: number;

  @ApiProperty()
  createdAt: Date;
}

export class PaginatedOrdersDto {
  @ApiProperty({ type: [OrderResponseDto] })
  data: OrderResponseDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  totalPages: number;

  @ApiProperty()
  hasNext: boolean;

  @ApiProperty()
  hasPrev: boolean;
}

