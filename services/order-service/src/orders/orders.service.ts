import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { ConfigService } from '@nestjs/config';
import {
  CreateOrderDto,
  UpdateOrderDto,
  UpdateOrderStatusDto,
  OrderQueryDto,
  OrderResponseDto,
  OrderSummaryDto,
  PaginatedOrdersDto,
} from './dto';
import { OrderStatus, PaymentStatus } from './enums';
import { Order, OrderItem, Address } from './entities';
import { UserService } from '../external/user/user.service';
import { ProductService } from '../external/product/product.service';
import { CartService } from '../external/cart/cart.service';
import { PaymentService } from '../external/payment/payment.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly userService: UserService,
    private readonly productService: ProductService,
    private readonly cartService: CartService,
    private readonly paymentService: PaymentService,
  ) {}

  async createOrder(createOrderDto: CreateOrderDto, userId?: string, sessionId?: string): Promise<OrderResponseDto> {
    const { 
      customerEmail, 
      customerPhone, 
      shippingAddress, 
      billingAddress, 
      items, 
      couponCode, 
      paymentMethod, 
      fromCart = true 
    } = createOrderDto;

    this.logger.debug(`Creating order for user: ${userId || 'guest'}, session: ${sessionId}`);

    const result = await this.prisma.$transaction(async (prisma) => {
      let orderItems: any[] = [];
      let finalUserId = userId;
      let finalCustomerEmail = customerEmail;

      if (userId) {
        const user = await this.userService.getUserById(userId);
        if (!user) {
          throw new BadRequestException('User not found');
        }
        finalCustomerEmail = user.email;
      } else if (!customerEmail) {
        throw new BadRequestException('Customer email is required for guest orders');
      }

      if (fromCart) {
        const cart = userId 
          ? await this.cartService.getCartByUserId(userId)
          : sessionId 
          ? await this.cartService.getCartBySessionId(sessionId)
          : null;

        if (!cart || !cart.items || cart.items.length === 0) {
          throw new BadRequestException('Cart is empty or not found');
        }

        orderItems = cart.items.map(item => ({
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        }));
      } else if (items && items.length > 0) {
        orderItems = items;
      } else {
        throw new BadRequestException('No items provided for order');
      }

      let subtotal = 0;
      const validatedItems: any[] = [];

      for (const item of orderItems) {
        const product = await this.productService.getProductById(item.productId);
        if (!product || !product.isActive) {
          throw new BadRequestException(`Product ${item.productId} not found or inactive`);
        }

        const isAvailable = await this.productService.validateProductAvailability(
          item.productId,
          item.variantId || null,
          item.quantity,
        );

        if (!isAvailable) {
          throw new BadRequestException(`Insufficient stock for product ${product.name}`);
        }

        const unitPrice = item.unitPrice || product.salePrice || product.price;
        const totalPrice = unitPrice * item.quantity;
        subtotal += totalPrice;

        validatedItems.push({
          productId: item.productId,
          productName: product.name,
          productSku: product.sku,
          productSlug: product.slug,
          variantId: item.variantId,
          unitPrice,
          quantity: item.quantity,
          totalPrice,
          productImage: product.images?.[0],
          brand: product.brand,
          category: product.category,
        });
      }

      const taxRate = this.configService.get<number>('TAX_RATE', 0.08);
      const taxAmount = subtotal * taxRate;
      const shippingCost = this.calculateShippingCost(subtotal, shippingAddress.country);

      let discountAmount = 0;
      let couponDiscount = 0;
      if (couponCode) {
        const couponValidation = await this.cartService.validateCoupon(couponCode, userId);
        if (couponValidation.valid) {
          couponDiscount = couponValidation.discountAmount;
          discountAmount = Math.min(couponDiscount, subtotal * 0.5); // Max 50% discount
        }
      }

      const totalAmount = subtotal + taxAmount + shippingCost - discountAmount;

      const stockReservation = await this.productService.reserveStock(
        validatedItems.map(item => ({
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
        }))
      );

      if (!stockReservation) {
        throw new ConflictException('Failed to reserve stock for order items');
      }

      try {
        const order = await prisma.order.create({
          data: {
            userId: finalUserId,
            sessionId,
            status: OrderStatus.PENDING,
            paymentStatus: PaymentStatus.PENDING,
            subtotal,
            taxAmount,
            shippingCost,
            discountAmount,
            totalAmount,
            paymentMethod,
            shippingAddress: shippingAddress as any,
            billingAddress: billingAddress as any,
            customerEmail: finalCustomerEmail!,
            customerPhone,
            couponCode,
            couponDiscount,
            items: {
              create: validatedItems,
            },
            statusHistory: {
              create: {
                toStatus: OrderStatus.PENDING,
                reason: 'Order created',
                changedByType: 'SYSTEM',
              },
            },
          },
          include: {
            items: true,
            statusHistory: true,
          },
        });

        if (fromCart) {
          await this.cartService.clearCart(userId, sessionId);
        }

        this.logger.log(`Order created successfully: ${order.orderNumber}`);
        return this.mapOrderToDto(order);

      } catch (error) {
        await this.productService.releaseStock(
          validatedItems.map(item => ({
            productId: item.productId,
            variantId: item.variantId,
            quantity: item.quantity,
          }))
        );
        throw error;
      }
    });

    return result;
  }

  async getOrderById(orderId: string, userId?: string): Promise<OrderResponseDto> {
    this.logger.debug(`Fetching order: ${orderId}`);

    const where: Prisma.OrderWhereInput = { id: orderId };
    if (userId) {
      where.userId = userId;
    }

    const order = await this.prisma.order.findFirst({
      where,
      include: {
        items: true,
        statusHistory: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return this.mapOrderToDto(order);
  }

  async getOrderByNumber(orderNumber: string, userId?: string): Promise<OrderResponseDto> {
    this.logger.debug(`Fetching order by number: ${orderNumber}`);

    const where: Prisma.OrderWhereInput = { orderNumber };
    if (userId) {
      where.userId = userId;
    }

    const order = await this.prisma.order.findFirst({
      where,
      include: {
        items: true,
        statusHistory: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return this.mapOrderToDto(order);
  }

  async getOrders(queryDto: OrderQueryDto, userId?: string): Promise<PaginatedOrdersDto> {
    const {
      page = 1,
      limit = 10,
      status,
      paymentStatus,
      userId: filterUserId,
      customerEmail,
      orderNumber,
      dateFrom,
      dateTo,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = queryDto;

    this.logger.debug(`Fetching orders - page: ${page}, limit: ${limit}`);

    const where: Prisma.OrderWhereInput = {};

    if (userId) {
      where.userId = userId;
    } else if (filterUserId) {
      where.userId = filterUserId;
    }

    if (status) where.status = status;
    if (paymentStatus) where.paymentStatus = paymentStatus;
    if (customerEmail) where.customerEmail = { contains: customerEmail, mode: 'insensitive' };
    if (orderNumber) where.orderNumber = { contains: orderNumber, mode: 'insensitive' };

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    const skip = (page - 1) * limit;
    const orderBy = { [sortBy]: sortOrder };

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: {
          items: true,
          statusHistory: {
            orderBy: { createdAt: 'desc' },
            take: 1, 
          },
        },
        skip,
        take: limit,
        orderBy,
      }),
      this.prisma.order.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: orders.map(order => this.mapOrderToDto(order)),
      total,
      page,
      limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };
  }

  async updateOrderStatus(
    orderId: string,
    updateStatusDto: UpdateOrderStatusDto,
    userId?: string,
    userType: 'SYSTEM' | 'USER' | 'ADMIN' = 'SYSTEM',
  ): Promise<OrderResponseDto> {
    const { status, reason, notes } = updateStatusDto;

    this.logger.debug(`Updating order ${orderId} status to ${status}`);

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const orderEntity = new Order(order as any);
    if (!orderEntity.canTransitionTo(status)) {
      throw new BadRequestException(`Cannot transition from ${order.status} to ${status}`);
    }

    const updateData: any = {
      status,
      updatedAt: new Date(),
    };

    if (status === OrderStatus.SHIPPED && !order.shippedAt) {
      updateData.shippedAt = new Date();
    }
    if (status === OrderStatus.DELIVERED && !order.deliveredAt) {
      updateData.deliveredAt = new Date();
    }

    if (status === OrderStatus.CANCELLED && order.status !== OrderStatus.CANCELLED) {
      await this.productService.releaseStock(
        order.items.map(item => ({
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
        }))
      );
    }

    const updatedOrder = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        ...updateData,
        statusHistory: {
          create: {
            fromStatus: order.status,
            toStatus: status,
            reason,
            notes,
            changedBy: userId,
            changedByType: userType,
          },
        },
      },
      include: {
        items: true,
        statusHistory: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    this.logger.log(`Order ${orderId} status updated to ${status}`);
    return this.mapOrderToDto(updatedOrder);
  }

  async updateOrder(orderId: string, updateOrderDto: UpdateOrderDto, userId?: string): Promise<OrderResponseDto> {
    this.logger.debug(`Updating order: ${orderId}`);

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const orderEntity = new Order(order as any);
    if (!orderEntity.isEditable()) {
      throw new BadRequestException('Order cannot be modified in current status');
    }

    const updatedOrder = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        updateOrderDto,
        updatedAt: new Date(),
      },
      include: {
        items: true,
        statusHistory: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    return this.mapOrderToDto(updatedOrder);
  }

  async cancelOrder(orderId: string, reason?: string, userId?: string): Promise<OrderResponseDto> {
    this.logger.debug(`Cancelling order: ${orderId}`);

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const orderEntity = new Order(order as any);
    if (!orderEntity.isCancellable()) {
      throw new BadRequestException('Order cannot be cancelled in current status');
    }

    if (order.paymentStatus === PaymentStatus.PAID && order.paymentId) {
      try {
        const refundResult = await this.paymentService.refundPayment({
          paymentId: order.paymentId,
        });
        if (refundResult.status === 'success') {
          await this.prisma.order.update({
            where: { id: orderId },
            data: { paymentStatus: PaymentStatus.REFUNDED },
          });
        }
      } catch (error) {
        this.logger.error(`Failed to process refund for order ${orderId}:`, error);
      }
    }

    return this.updateOrderStatus(
      orderId,
      {
        status: OrderStatus.CANCELLED,
        reason: reason || 'Order cancelled by request',
      },
      userId,
      userId ? 'USER' : 'SYSTEM',
    );
  }

  async getOrderSummary(userId: string): Promise<{ orders: OrderSummaryDto[]; stats: any }> {
    this.logger.debug(`Fetching order summary for user: ${userId}`);

    const [recentOrders, stats] = await Promise.all([
      this.prisma.order.findMany({
        where: { userId },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          totalAmount: true,
          createdAt: true,
          items: {
            select: { quantity: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      this.prisma.order.aggregate({
        where: { userId },
        _count: { id: true },
        _sum: { totalAmount: true },
      }),
    ]);

    const orderSummaries: OrderSummaryDto[] = recentOrders.map(order => ({
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status as OrderStatus,
      totalAmount: Number(order.totalAmount),
      itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
      createdAt: order.createdAt,
    }));

    const orderStats = {
      totalOrders: stats._count.id,
      totalSpent: Number(stats._sum.totalAmount || 0),
    };

    return {
      orders: orderSummaries,
      stats: orderStats,
    };
  }

  private calculateShippingCost(subtotal: number, country: string): number {
    const freeShippingThreshold = this.configService.get<number>('FREE_SHIPPING_THRESHOLD', 100);
    
    if (subtotal >= freeShippingThreshold) {
      return 0;
    }

    let shippingCost = 10;

    if (country.toLowerCase() !== 'us') {
      shippingCost += 15;
    }

    return shippingCost;
  }

  private mapOrderToDto(order: any): OrderResponseDto {
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      userId: order.userId,
      status: order.status as OrderStatus,
      paymentStatus: order.paymentStatus,
      subtotal: Number(order.subtotal),
      taxAmount: Number(order.taxAmount),
      shippingCost: Number(order.shippingCost),
      discountAmount: Number(order.discountAmount),
      totalAmount: Number(order.totalAmount),
      paymentMethod: order.paymentMethod,
      paymentId: order.paymentId,
      shippingAddress: order.shippingAddress,
      billingAddress: order.billingAddress,
      customerEmail: order.customerEmail,
      customerPhone: order.customerPhone,
      couponCode: order.couponCode,
      couponDiscount: order.couponDiscount ? Number(order.couponDiscount) : undefined,
      trackingNumber: order.trackingNumber,
      shippedAt: order.shippedAt,
      deliveredAt: order.deliveredAt,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      items: order.items?.map((item: any) => ({
        id: item.id,
        productId: item.productId,
        productName: item.productName,
        productSku: item.productSku,
        productSlug: item.productSlug,
        variantId: item.variantId,
        variantName: item.variantName,
        attributes: item.attributes,
        unitPrice: Number(item.unitPrice),
        quantity: item.quantity,
        totalPrice: Number(item.totalPrice),
        productImage: item.productImage,
        brand: item.brand,
        category: item.category,
      })) || [],
      statusHistory: order.statusHistory?.map((history: any) => ({
        id: history.id,
        fromStatus: history.fromStatus,
        toStatus: history.toStatus,
        reason: history.reason,
        notes: history.notes,
        changedBy: history.changedBy,
        changedByType: history.changedByType,
        createdAt: history.createdAt,
      })) || [],
    };
  }
}