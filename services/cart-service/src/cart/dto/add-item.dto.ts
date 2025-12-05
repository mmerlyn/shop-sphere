import { IsString, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class AddItemDto {
  @IsString()
  productId: string;

  @IsNumber()
  @Min(1)
  @Type(() => Number)
  quantity: number;
}
