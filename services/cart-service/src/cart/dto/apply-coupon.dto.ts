import { IsString, Length, Matches } from 'class-validator';

export class ApplyCouponDto {
  @IsString()
  @Length(3, 20)
  @Matches(/^[A-Z0-9]+$/, { message: 'Coupon code must contain only uppercase letters and numbers' })
  couponCode: string;
}

export class RemoveCouponDto {
  
}

export class CouponResponseDto {
  success: boolean;
  message: string;
  couponCode?: string;
  discountAmount?: string;
  cart?: any;

  constructor(success: boolean, message: string, couponCode?: string, discountAmount?: string, cart?: any) {
    this.success = success;
    this.message = message;
    this.couponCode = couponCode;
    this.discountAmount = discountAmount;
    this.cart = cart;
  }
}