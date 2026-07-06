import { IsInt, IsArray, ValidateNested, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class AdjustStockDto {
  @IsInt()
  delta: number; // positive = restock, negative = decrement
}

export class StockLineDto {
  @IsString()
  productId: string;

  @IsInt()
  @Min(1)
  quantity: number;
}

// A checkout decrements many products atomically.
export class DecrementBatchDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StockLineDto)
  items: StockLineDto[];
}

export class UpsertItemDto {
  @IsString()
  productId: string;

  @IsInt()
  @Min(0)
  available: number;
}

// Bulk seed endpoint payload.
export class BulkUpsertDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpsertItemDto)
  items: UpsertItemDto[];
}
