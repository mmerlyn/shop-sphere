import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEmail,
  IsOptional,
  IsArray,
  IsNumber,
  IsBoolean,
  ValidateNested,
  ArrayNotEmpty,
  Length,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AddressDto {
  @ApiProperty({ description: 'First name' })
  @IsString()
  @Length(1, 50)
  firstName: string;

  @ApiProperty({ description: 'Last name' })
  @IsString()
  @Length(1, 50)
  lastName: string;

  @ApiPropertyOptional({ description: 'Company name' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  company?: string;

  @ApiProperty({ description: 'Address line 1' })
  @IsString()
  @Length(1, 100)
  address1: string;

  @ApiPropertyOptional({ description: 'Address line 2' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  address2?: string;

  @ApiProperty({ description: 'City' })
  @IsString()
  @Length(1, 50)
  city: string;

  @ApiProperty({ description: 'State/Province' })
  @IsString()
  @Length(1, 50)
  state: string;

  @ApiProperty({ description: 'Postal/ZIP code' })
  @IsString()
  @Length(1, 20)
  postalCode: string;

  @ApiProperty({ description: 'Country code (e.g., US, CA, GB)' })
  @IsString()
  @Length(2, 3)
  country: string;

  @ApiPropertyOptional({ description: 'Phone number' })
  @IsOptional()
  @IsString()
  @Length(1, 20)
  phone?: string;
}

export class CreateOrderItemDto {
  @ApiProperty({ description: 'Product ID' })
  @IsString()
  productId: string;

  @ApiPropertyOptional({ description: 'Product variant ID' })
  @IsOptional()
  @IsString()
  variantId?: string;

  @ApiProperty({ description: 'Quantity', minimum: 1 })
  @IsNumber()
  @Min(1)
  @Max(100)
  quantity: number;

  @ApiPropertyOptional({ description: 'Unit price (if provided, overrides product price)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  unitPrice?: number;
}

export class CreateOrderDto {
  @ApiProperty({ description: 'Customer email address' })
  @IsEmail()
  customerEmail: string;

  @ApiPropertyOptional({ description: 'Customer phone number' })
  @IsOptional()
  @IsString()
  @Length(1, 20)
  customerPhone?: string;

  @ApiProperty({ description: 'Shipping address', type: AddressDto })
  @ValidateNested()
  @Type(() => AddressDto)
  shippingAddress: AddressDto;

  @ApiProperty({ description: 'Billing address', type: AddressDto })
  @ValidateNested()
  @Type(() => AddressDto)
  billingAddress: AddressDto;

  @ApiPropertyOptional({ 
    description: 'Order items (required if fromCart is false)', 
    type: [CreateOrderItemDto] 
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items?: CreateOrderItemDto[];

  @ApiPropertyOptional({ description: 'Coupon code' })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  couponCode?: string;

  @ApiPropertyOptional({ description: 'Payment method' })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  paymentMethod?: string;

  @ApiPropertyOptional({ description: 'Order notes' })
  @IsOptional()
  @IsString()
  @Length(1, 1000)
  notes?: string;

  @ApiPropertyOptional({ 
    description: 'Create order from cart items (if true, items array will be ignored)', 
    default: false 
  })
  @IsOptional()
  @IsBoolean()
  fromCart?: boolean = false;
}

