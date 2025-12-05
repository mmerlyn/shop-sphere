import { IsString, MinLength } from 'class-validator';

export class ApplyCouponDto {
  @IsString()
  @MinLength(1)
  code: string;
}
