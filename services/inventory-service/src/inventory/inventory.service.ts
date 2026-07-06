import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { StockLineDto, UpsertItemDto } from './dto';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async getOne(productId: string) {
    const item = await this.prisma.inventoryItem.findUnique({
      where: { productId },
    });
    if (!item) throw new NotFoundException(`No inventory for ${productId}`);
    return { ...item, inStock: item.available > 0 };
  }

  async getMany(ids: string[]) {
    if (!ids.length) return [];
    return this.prisma.inventoryItem.findMany({
      where: { productId: { in: ids } },
    });
  }

  // Atomic multi-line decrement.
  async decrementBatch(items: StockLineDto[]) {
    if (!items?.length) throw new BadRequestException('No items to decrement');

    // Fast path: a single line is atomic on its own — one conditional UPDATE,
    // no interactive transaction (which would hold a pool connection and is the
    // throughput bottleneck under checkout load).
    if (items.length === 1) {
      const line = items[0];
      const result = await this.prisma.inventoryItem.updateMany({
        where: { productId: line.productId, available: { gte: line.quantity } },
        data: { available: { decrement: line.quantity } },
      });
      if (result.count === 0) {
        throw new BadRequestException(
          `Insufficient stock for product ${line.productId}`,
        );
      }
      return { ok: true, decremented: 1 };
    }

    // Multi-line: all-or-nothing interactive transaction (generous timeout).
    return this.prisma.$transaction(
      async (tx) => {
        for (const line of items) {
          const result = await tx.inventoryItem.updateMany({
            where: { productId: line.productId, available: { gte: line.quantity } },
            data: { available: { decrement: line.quantity } },
          });
          if (result.count === 0) {
            throw new BadRequestException(
              `Insufficient stock for product ${line.productId}`,
            );
          }
        }
        return { ok: true, decremented: items.length };
      },
      { timeout: 15000, maxWait: 15000 },
    );
  }

  async restockBatch(items: StockLineDto[]) {
    return this.prisma.$transaction(
      items.map((line) =>
        this.prisma.inventoryItem.update({
          where: { productId: line.productId },
          data: { available: { increment: line.quantity } },
        }),
      ),
    );
  }

  async adjust(productId: string, delta: number) {
    const item = await this.prisma.inventoryItem.findUnique({
      where: { productId },
    });
    if (!item) throw new NotFoundException(`No inventory for ${productId}`);
    const next = item.available + delta;
    if (next < 0) throw new BadRequestException('Insufficient inventory');
    return this.prisma.inventoryItem.update({
      where: { productId },
      data: { available: next },
    });
  }

  // Idempotent bulk seed. createMany + skipDuplicates keeps it fast for 1M rows.
  async bulkUpsert(items: UpsertItemDto[]) {
    if (!items?.length) return { upserted: 0 };
    const result = await this.prisma.inventoryItem.createMany({
      data: items.map((i) => ({ productId: i.productId, available: i.available })),
      skipDuplicates: true,
    });
    return { upserted: result.count };
  }
}
