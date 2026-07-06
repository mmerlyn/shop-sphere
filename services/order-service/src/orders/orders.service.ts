import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { CreateOrderDto, UpdateOrderStatusDto, OrderStatus } from './dto';
import { Prisma } from '../generated/prisma';
import axios from 'axios';
import * as http from 'http';
import * as https from 'https';

// Pooled keep-alive client — reuse upstream connections to cart/inventory/user
// services under checkout load instead of opening a socket per call.
const httpClient = axios.create({
  httpAgent: new http.Agent({ keepAlive: true, maxSockets: 256, keepAliveMsecs: 30000 }),
  httpsAgent: new https.Agent({ keepAlive: true, maxSockets: 256, keepAliveMsecs: 30000 }),
  timeout: 15000,
});

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);
  private readonly cartServiceUrl: string;
  private readonly productServiceUrl: string;
  private readonly inventoryServiceUrl: string;
  private readonly userServiceUrl: string;
  private readonly notificationServiceUrl: string;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    this.cartServiceUrl =
      this.configService.get<string>('CART_SERVICE_URL') || 'http://localhost:3003';
    this.productServiceUrl =
      this.configService.get<string>('PRODUCT_SERVICE_URL') || 'http://localhost:3002';
    this.inventoryServiceUrl =
      this.configService.get<string>('INVENTORY_SERVICE_URL') || 'http://localhost:3008';
    this.userServiceUrl =
      this.configService.get<string>('USER_SERVICE_URL') || 'http://localhost:3001';
    this.notificationServiceUrl =
      this.configService.get<string>('NOTIFICATION_SERVICE_URL') || 'http://localhost:3005';
  }

  async create(userId: string, createOrderDto: CreateOrderDto) {
    const { cartId, shippingAddress, billingAddress, paymentMethod, notes } =
      createOrderDto;

    const cart = await this.fetchCart(cartId);

    if (!cart || cart.items.length === 0) {
      throw new BadRequestException('Cart is empty');
    }

    const orderNumber = this.generateOrderNumber();

    const subtotal = cart.subtotal;
    const discount = cart.discount || 0;
    const shippingCost = this.calculateShipping(subtotal);
    const tax = this.calculateTax(subtotal - discount);
    const total = subtotal - discount + shippingCost + tax;

    const order = await this.prisma.order.create({
      data: {
        orderNumber,
        userId,
        subtotal: new Prisma.Decimal(subtotal),
        discount: new Prisma.Decimal(discount),
        shippingCost: new Prisma.Decimal(shippingCost),
        tax: new Prisma.Decimal(tax),
        total: new Prisma.Decimal(total),
        couponCode: cart.couponCode,
        shippingAddress: shippingAddress as any,
        billingAddress: (billingAddress || shippingAddress) as any,
        paymentMethod,
        notes,
        items: {
          create: cart.items.map((item: any) => ({
            productId: item.productId,
            name: item.name,
            sku: item.productId, // No separate SKU field in the catalog; productId doubles as SKU
            price: new Prisma.Decimal(item.price),
            quantity: item.quantity,
            image: item.image,
          })),
        },
      },
      include: { items: true },
    });

    // Decrement stock atomically via the Inventory service (REST, DNS-discovered).
    // Must stay on the hot path and awaited: insufficient stock has to fail the order.
    await this.decrementInventory(
      cart.items.map((item: any) => ({
        productId: item.productId,
        quantity: item.quantity,
      })),
    );

    // Cart clearing is best-effort cleanup with no bearing on order correctness
    // (order is already committed, stock already decremented), so — like the
    // confirmation email — it runs off the hot path instead of blocking the response.
    setImmediate(() => this.clearCart(cartId));
    setImmediate(() => this.dispatchOrderConfirmation(order));

    return order;
  }

  // Mocked confirmation dispatch — kept off the checkout hot path. Best-effort
  // notify; failures are swallowed so they never affect order success/latency.
  private async dispatchOrderConfirmation(order: any): Promise<void> {
    try {
      await httpClient.post(
        `${this.notificationServiceUrl}/api/notifications/order-confirmation`,
        { orderNumber: order.orderNumber, userId: order.userId, total: Number(order.total) },
      );
    } catch {
      /* mocked email — ignore */
    }
  }

  private async fetchUser(userId: string): Promise<any> {
    try {
      const response = await httpClient.get(`${this.userServiceUrl}/api/users/${userId}`);
      return response.data;
    } catch (error) {
      this.logger.warn(`Failed to fetch user ${userId}`);
      return null;
    }
  }

  async findAll(userId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where: { userId },
        include: { items: true },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.order.count({ where: { userId } }),
    ]);

    return {
      data: orders,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, userId?: string) {
    const where: any = { id };
    if (userId) {
      where.userId = userId;
    }

    const order = await this.prisma.order.findFirst({
      where,
      include: { items: true },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }

  async findByOrderNumber(orderNumber: string, userId?: string) {
    const where: any = { orderNumber };
    if (userId) {
      where.userId = userId;
    }

    const order = await this.prisma.order.findFirst({
      where,
      include: { items: true },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }

  async updateStatus(id: string, updateStatusDto: UpdateOrderStatusDto) {
    const order = await this.findOne(id);

    this.validateStatusTransition(order.status as OrderStatus, updateStatusDto.status);

    const updated = await this.prisma.order.update({
      where: { id },
      data: {
        status: updateStatusDto.status,
        notes: updateStatusDto.notes || order.notes,
      },
      include: { items: true },
    });

    if (updateStatusDto.status === OrderStatus.CANCELLED) {
      await this.restockInventory(
        order.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
        })),
      );
    }

    return updated;
  }

  async cancel(id: string, userId: string) {
    const order = await this.findOne(id, userId);

    if (!['PENDING', 'CONFIRMED'].includes(order.status)) {
      throw new BadRequestException('Order cannot be cancelled at this stage');
    }

    return this.updateStatus(id, { status: OrderStatus.CANCELLED });
  }

  async findAllAdmin(
    page = 1,
    limit = 10,
    status?: OrderStatus,
  ) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (status) {
      where.status = status;
    }

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: { items: true },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      data: orders,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getStats() {
    const [
      totalOrders,
      pendingOrders,
      completedOrders,
      totalRevenue,
    ] = await Promise.all([
      this.prisma.order.count(),
      this.prisma.order.count({ where: { status: 'PENDING' } }),
      this.prisma.order.count({ where: { status: 'DELIVERED' } }),
      this.prisma.order.aggregate({
        where: { status: 'DELIVERED' },
        _sum: { total: true },
      }),
    ]);

    return {
      totalOrders,
      pendingOrders,
      completedOrders,
      totalRevenue: totalRevenue._sum.total || 0,
    };
  }

  private generateOrderNumber(): string {
    const prefix = 'ORD';
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
  }

  private calculateShipping(subtotal: number): number {
    // Free shipping over $100
    if (subtotal >= 100) return 0;
    return 9.99;
  }

  private calculateTax(amount: number): number {
    // 8% tax rate
    return Math.round(amount * 0.08 * 100) / 100;
  }

  private validateStatusTransition(
    currentStatus: OrderStatus,
    newStatus: OrderStatus,
  ): void {
    const validTransitions: Record<OrderStatus, OrderStatus[]> = {
      [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
      [OrderStatus.CONFIRMED]: [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
      [OrderStatus.PROCESSING]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
      [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED],
      [OrderStatus.DELIVERED]: [OrderStatus.REFUNDED],
      [OrderStatus.CANCELLED]: [],
      [OrderStatus.REFUNDED]: [],
    };

    if (!validTransitions[currentStatus]?.includes(newStatus)) {
      throw new BadRequestException(
        `Cannot transition from ${currentStatus} to ${newStatus}`,
      );
    }
  }

  private async fetchCart(cartId: string): Promise<any> {
    try {
      const response = await httpClient.get(
        `${this.cartServiceUrl}/api/cart/${cartId}`,
      );
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to fetch cart ${cartId}`);
      throw new BadRequestException('Failed to fetch cart');
    }
  }

  private async clearCart(cartId: string): Promise<void> {
    try {
      await httpClient.delete(`${this.cartServiceUrl}/api/cart/${cartId}/items`);
    } catch (error) {
      this.logger.warn(`Failed to clear cart ${cartId}`);
    }
  }

  // Atomic, all-or-nothing stock decrement across every line in the order.
  // If Inventory rejects (insufficient stock), the checkout fails loudly.
  private async decrementInventory(
    items: { productId: string; quantity: number }[],
  ): Promise<void> {
    try {
      await httpClient.post(`${this.inventoryServiceUrl}/api/inventory/decrement`, {
        items,
      });
    } catch (error) {
      const msg =
        error?.response?.data?.message || 'Inventory decrement failed';
      this.logger.warn(`Inventory decrement failed: ${msg}`);
      throw new BadRequestException(msg);
    }
  }

  // Compensating restock when an order is cancelled.
  private async restockInventory(
    items: { productId: string; quantity: number }[],
  ): Promise<void> {
    try {
      await httpClient.post(`${this.inventoryServiceUrl}/api/inventory/restock`, {
        items,
      });
    } catch (error) {
      this.logger.warn('Failed to restock inventory after cancellation');
    }
  }
}
