import { Test, TestingModule } from '@nestjs/testing';
import { OrdersService } from './orders.service';
import { PrismaService } from '../database/prisma.service';
import { ConfigService } from '@nestjs/config';
import { UserService } from '../external/user/user.service';
import { ProductService } from '../external/product/product.service';
import { CartService } from '../external/cart/cart.service';
import { PaymentService } from '../external/payment/payment.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { OrderStatus, PaymentStatus } from './enums';

describe('OrdersService', () => {
  let service: OrdersService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    order: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockUserService = {
    getUserById: jest.fn(),
    validateUser: jest.fn(),
  };

  const mockProductService = {
    getProductById: jest.fn(),
    validateProductAvailability: jest.fn(),
    reserveStock: jest.fn(),
    releaseStock: jest.fn(),
  };

  const mockCartService = {
    getCartByUserId: jest.fn(),
    getCartBySessionId: jest.fn(),
    clearCart: jest.fn(),
    validateCoupon: jest.fn(),
  };

  const mockPaymentService = {
    processPayment: jest.fn(),
    refundPayment: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: any) => {
      const config = {
        TAX_RATE: 0.08,
        FREE_SHIPPING_THRESHOLD: 100,
      };
      return config[key] || defaultValue;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: UserService, useValue: mockUserService },
        { provide: ProductService, useValue: mockProductService },
        { provide: CartService, useValue: mockCartService },
        { provide: PaymentService, useValue: mockPaymentService },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getOrderById', () => {
    it('should return an order when found', async () => {
      const orderId = 'order-1';
      const mockOrder = {
        id: orderId,
        orderNumber: 'ORD-001',
        status: OrderStatus.PENDING,
        paymentStatus: PaymentStatus.PENDING,
        subtotal: 100,
        taxAmount: 8,
        shippingCost: 10,
        discountAmount: 0,
        totalAmount: 118,
        customerEmail: 'test@example.com',
        shippingAddress: {},
        billingAddress: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        items: [],
        statusHistory: [],
      };

      mockPrismaService.order.findFirst.mockResolvedValue(mockOrder);

      const result = await service.getOrderById(orderId);

      expect(result).toBeDefined();
      expect(result.id).toBe(orderId);
      expect(mockPrismaService.order.findFirst).toHaveBeenCalledWith({
        where: { id: orderId },
        include: {
          items: true,
          statusHistory: {
            orderBy: { createdAt: 'desc' },
          },
        },
      });
    });

    it('should throw NotFoundException when order not found', async () => {
      const orderId = 'non-existent-order';
      mockPrismaService.order.findFirst.mockResolvedValue(null);

      await expect(service.getOrderById(orderId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateOrderStatus', () => {
    it('should update order status successfully', async () => {
      const orderId = 'order-1';
      const mockOrder = {
        id: orderId,
        status: OrderStatus.PENDING,
        items: [],
      };

      const updatedOrder = {
        ...mockOrder,
        status: OrderStatus.CONFIRMED,
        statusHistory: [],
        items: [],
      };

      mockPrismaService.order.findUnique.mockResolvedValue(mockOrder);
      mockPrismaService.order.update.mockResolvedValue(updatedOrder);

      const result = await service.updateOrderStatus(
        orderId,
        { status: OrderStatus.CONFIRMED, reason: 'Payment confirmed' }
      );

      expect(result).toBeDefined();
      expect(mockPrismaService.order.update).toHaveBeenCalled();
    });

    it('should throw NotFoundException when order not found', async () => {
      const orderId = 'non-existent-order';
      mockPrismaService.order.findUnique.mockResolvedValue(null);

      await expect(service.updateOrderStatus(
        orderId,
        { status: OrderStatus.CONFIRMED }
      )).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for invalid status transition', async () => {
      const orderId = 'order-1';
      const mockOrder = {
        id: orderId,
        status: OrderStatus.DELIVERED,
        items: [],
      };

      mockPrismaService.order.findUnique.mockResolvedValue(mockOrder);

      await expect(service.updateOrderStatus(
        orderId,
        { status: OrderStatus.PENDING }
      )).rejects.toThrow(BadRequestException);
    });
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});