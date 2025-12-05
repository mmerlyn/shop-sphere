import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { CreateOrderDto, UpdateOrderStatusDto, OrderStatus } from './dto';
import { Prisma } from '@prisma/client';
import axios from 'axios';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);
  private readonly cartServiceUrl: string;
  private readonly productServiceUrl: string;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    this.cartServiceUrl =
      this.configService.get<string>('CART_SERVICE_URL') || 'http://localhost:3003';
    this.productServiceUrl =
      this.configService.get<string>('PRODUCT_SERVICE_URL') || 'http://localhost:3002';
  }

  async create(userId: string, createOrderDto: CreateOrderDto) {
    const { cartId, shippingAddress, billingAddress, paymentMethod, notes } =
      createOrderDto;

    // Fetch cart from Cart Service
    const cart = await this.fetchCart(cartId);

    if (!cart || cart.items.length === 0) {
      throw new BadRequestException('Cart is empty');
    }

    // Generate order number
    const orderNumber = this.generateOrderNumber();

    // Calculate totals
    const subtotal = cart.subtotal;
    const discount = cart.discount || 0;
    const shippingCost = this.calculateShipping(subtotal);
    const tax = this.calculateTax(subtotal - discount);
    const total = subtotal - discount + shippingCost + tax;

    // Create order with items
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
            sku: item.productId, // Using productId as SKU for now
            price: new Prisma.Decimal(item.price),
            quantity: item.quantity,
            image: item.image,
          })),
        },
      },
      include: { items: true },
    });

    // Update inventory for each product
    for (const item of cart.items) {
      await this.updateProductInventory(item.productId, -item.quantity);
    }

    // Clear the cart after successful order
    await this.clearCart(cartId);

    return order;
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

    // Validate status transition
    this.validateStatusTransition(order.status as OrderStatus, updateStatusDto.status);

    const updated = await this.prisma.order.update({
      where: { id },
      data: {
        status: updateStatusDto.status,
        notes: updateStatusDto.notes || order.notes,
      },
      include: { items: true },
    });

    // If order is cancelled, restore inventory
    if (updateStatusDto.status === OrderStatus.CANCELLED) {
      for (const item of order.items) {
        await this.updateProductInventory(item.productId, item.quantity);
      }
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

  // Admin methods
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
      const response = await axios.get(
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
      await axios.delete(`${this.cartServiceUrl}/api/cart/${cartId}/items`);
    } catch (error) {
      this.logger.warn(`Failed to clear cart ${cartId}`);
    }
  }

  private async updateProductInventory(
    productId: string,
    quantity: number,
  ): Promise<void> {
    try {
      await axios.patch(
        `${this.productServiceUrl}/api/products/${productId}/inventory`,
        { quantity },
      );
    } catch (error) {
      this.logger.warn(`Failed to update inventory for product ${productId}`);
    }
  }
}
