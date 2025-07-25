import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  ValidateNested,
  Length,
} from 'class-validator';
import { Type } from 'class-transformer';
import { OrderStatus, PaymentStatus } from '../enums';
import { AddressDto } from './create-order.dto';

export class UpdateOrderStatusDto {
  @ApiProperty({ description: 'New order status', enum: OrderStatus })
  @IsString()
  status: OrderStatus;

  @ApiPropertyOptional({ description: 'Reason for status change' })
  @IsOptional()
  @IsString()
  @Length(1, 500)
  reason?: string;

  @ApiPropertyOptional({ description: 'Additional notes' })
  @IsOptional()
  @IsString()
  @Length(1, 1000)
  notes?: string;
}

export class UpdateOrderDto {
  @ApiPropertyOptional({ description: 'Customer phone number' })
  @IsOptional()
  @IsString()
  @Length(1, 20)
  customerPhone?: string;

  @ApiPropertyOptional({ description: 'Shipping address', type: AddressDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  shippingAddress?: AddressDto;

  @ApiPropertyOptional({ description: 'Billing address', type: AddressDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  billingAddress?: AddressDto;

  @ApiPropertyOptional({ description: 'Tracking number' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  trackingNumber?: string;

  @ApiPropertyOptional({ description: 'Payment method' })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  paymentMethod?: string;

  @ApiPropertyOptional({ description: 'Payment ID from payment gateway' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  paymentId?: string;

  @ApiPropertyOptional({ description: 'Payment status', enum: PaymentStatus })
  @IsOptional()
  @IsString()
  paymentStatus?: PaymentStatus;
}

