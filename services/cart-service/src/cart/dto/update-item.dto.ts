import { IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateItemDto {
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  quantity: number;
}
