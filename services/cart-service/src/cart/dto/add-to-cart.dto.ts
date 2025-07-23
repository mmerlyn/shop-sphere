import { IsString, IsNumber, IsOptional, Min, Max, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';

export class AddToCartDto {
  @IsString()
  @IsUUID()
  productId: string;

  @IsOptional()
  @IsString()
  variantId?: string;

  @IsNumber()
  @Min(1)
  @Max(99)
  @Transform(({ value }) => parseInt(value))
  quantity: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  unitPrice?: number;
}

export class AddToCartResponse {
  success: boolean;
  message: string;
  cart?: any;
  item?: any;

  constructor(success: boolean, message: string, cart?: any, item?: any) {
    this.success = success;
    this.message = message;
    this.cart = cart;
    this.item = item;
  }
}