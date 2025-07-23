import { IsString, IsNumber, IsOptional, Min, Max, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateCartItemDto {
  @IsString()
  @IsUUID()
  productId: string;

  @IsOptional()
  @IsString()
  variantId?: string;

  @IsNumber()
  @Min(0)
  @Max(99)
  @Transform(({ value }) => parseInt(value))
  quantity: number;
}

export class RemoveCartItemDto {
  @IsString()
  @IsUUID()
  productId: string;

  @IsOptional()
  @IsString()
  variantId?: string;
}

export class UpdateCartItemResponse {
  success: boolean;
  message: string;
  cart?: any;
  removedItem?: any;

  constructor(success: boolean, message: string, cart?: any, removedItem?: any) {
    this.success = success;
    this.message = message;
    this.cart = cart;
    this.removedItem = removedItem;
  }
}