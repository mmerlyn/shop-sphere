import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { AdjustStockDto, DecrementBatchDto, BulkUpsertDto } from './dto';

@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  // Stock for a single product (Catalog/frontend "in stock?" checks).
  @Get(':productId')
  getOne(@Param('productId') productId: string) {
    return this.inventory.getOne(productId);
  }

  // Batch stock lookup: GET /api/inventory?ids=a,b,c
  @Get()
  getMany(@Query('ids') ids: string) {
    return this.inventory.getMany((ids || '').split(',').filter(Boolean));
  }

  // Checkout hot path: atomically decrement stock for all lines in an order.
  // Rejects the whole batch if any line lacks sufficient stock.
  @Post('decrement')
  decrement(@Body() dto: DecrementBatchDto) {
    return this.inventory.decrementBatch(dto.items);
  }

  // Compensating action when an order is cancelled.
  @Post('restock')
  restock(@Body() dto: DecrementBatchDto) {
    return this.inventory.restockBatch(dto.items);
  }

  // Manual single-product adjustment (admin).
  @Patch(':productId/adjust')
  adjust(@Param('productId') productId: string, @Body() dto: AdjustStockDto) {
    return this.inventory.adjust(productId, dto.delta);
  }

  // Bulk upsert — used by the 1M-product seeder.
  @Post('bulk')
  bulkUpsert(@Body() dto: BulkUpsertDto) {
    return this.inventory.bulkUpsert(dto.items);
  }
}
