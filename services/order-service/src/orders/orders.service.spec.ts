import { Test, TestingModule } from '@nestjs/testing';
import { OrdersService } from './orders.service';
import { PrismaService } from '../database/prisma.service';
import { ConfigService } from '@nestjs/config';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { OrderStatus } from './dto';
import { Prisma } from '@prisma/client';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('OrdersService', () => {
  let service: OrdersService;
  let prismaService: PrismaService;

  const mockOrderItem = {
    id: 'item-1',
    orderId: 'order-1',
    productId: 'prod-1',
    name: 'Test Product',
    sku: 'TEST-001',
    price: new Prisma.Decimal(99.99),
    quantity: 2,
    image: 'image.jpg',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockOrder = {
    id: 'order-1',
    orderNumber: 'ORD-ABC123-XYZ',
    userId: 'user-1',
    status: 'PENDING',
    subtotal: new Prisma.Decimal(199.98),
    discount: new Prisma.Decimal(0),
    shippingCost: new Prisma.Decimal(0),
    tax: new Prisma.Decimal(16),
    total: new Prisma.Decimal(215.98),
    couponCode: null,
    shippingAddress: { street: '123 Main St', city: 'NYC' },
    billingAddress: { street: '123 Main St', city: 'NYC' },
    paymentMethod: 'card',
    paymentIntentId: null,
    notes: null,
    items: [mockOrderItem],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockCart = {
    id: 'cart-1',
    items: [
      {
        productId: 'prod-1',
        name: 'Test Product',
        price: 99.99,
        quantity: 2,
        image: 'image.jpg',
      },
    ],
    subtotal: 199.98,
    discount: 0,
    couponCode: null,
  };

  const mockPrismaService = {
    order: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
    },
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config: Record<string, string> = {
        CART_SERVICE_URL: 'http://localhost:3003',
        PRODUCT_SERVICE_URL: 'http://localhost:3002',
      };
      return config[key];
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
    prismaService = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createDto = {
      cartId: 'cart-1',
      shippingAddress: {
        firstName: 'John',
        lastName: 'Doe',
        address1: '123 Main St',
        city: 'New York',
        state: 'NY',
        postalCode: '10001',
        country: 'USA',
      },
      paymentMethod: 'card',
    };

    it('should create an order successfully', async () => {
      mockedAxios.get.mockResolvedValue({ data: mockCart });
      mockedAxios.patch.mockResolvedValue({});
      mockedAxios.delete.mockResolvedValue({});
      mockPrismaService.order.create.mockResolvedValue(mockOrder);

      const result = await service.create('user-1', createDto);

      expect(result).toBeDefined();
      expect(mockPrismaService.order.create).toHaveBeenCalled();
    });

    it('should throw BadRequestException for empty cart', async () => {
      mockedAxios.get.mockResolvedValue({ data: { items: [] } });

      await expect(service.create('user-1', createDto)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if cart fetch fails', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Cart service unavailable'));

      await expect(service.create('user-1', createDto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('should return paginated orders for user', async () => {
      mockPrismaService.order.findMany.mockResolvedValue([mockOrder]);
      mockPrismaService.order.count.mockResolvedValue(1);

      const result = await service.findAll('user-1', 1, 10);

      expect(result.data).toEqual([mockOrder]);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
      expect(mockPrismaService.order.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        include: { items: true },
        skip: 0,
        take: 10,
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should handle pagination correctly', async () => {
      mockPrismaService.order.findMany.mockResolvedValue([mockOrder]);
      mockPrismaService.order.count.mockResolvedValue(25);

      const result = await service.findAll('user-1', 2, 10);

      expect(result.meta.totalPages).toBe(3);
      expect(mockPrismaService.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 }),
      );
    });
  });

  describe('findOne', () => {
    it('should return an order by id', async () => {
      mockPrismaService.order.findFirst.mockResolvedValue(mockOrder);

      const result = await service.findOne('order-1');

      expect(result).toEqual(mockOrder);
    });

    it('should return an order by id and userId', async () => {
      mockPrismaService.order.findFirst.mockResolvedValue(mockOrder);

      const result = await service.findOne('order-1', 'user-1');

      expect(mockPrismaService.order.findFirst).toHaveBeenCalledWith({
        where: { id: 'order-1', userId: 'user-1' },
        include: { items: true },
      });
    });

    it('should throw NotFoundException if order not found', async () => {
      mockPrismaService.order.findFirst.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByOrderNumber', () => {
    it('should return an order by order number', async () => {
      mockPrismaService.order.findFirst.mockResolvedValue(mockOrder);

      const result = await service.findByOrderNumber('ORD-ABC123-XYZ');

      expect(result).toEqual(mockOrder);
    });

    it('should throw NotFoundException if order not found', async () => {
      mockPrismaService.order.findFirst.mockResolvedValue(null);

      await expect(service.findByOrderNumber('NONEXISTENT')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateStatus', () => {
    it('should update order status with valid transition', async () => {
      mockPrismaService.order.findFirst.mockResolvedValue(mockOrder);
      mockPrismaService.order.update.mockResolvedValue({
        ...mockOrder,
        status: 'CONFIRMED',
      });

      const result = await service.updateStatus('order-1', {
        status: OrderStatus.CONFIRMED,
      });

      expect(result.status).toBe('CONFIRMED');
    });

    it('should throw BadRequestException for invalid status transition', async () => {
      mockPrismaService.order.findFirst.mockResolvedValue(mockOrder);

      await expect(
        service.updateStatus('order-1', { status: OrderStatus.DELIVERED }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should restore inventory when order is cancelled', async () => {
      mockPrismaService.order.findFirst.mockResolvedValue(mockOrder);
      mockPrismaService.order.update.mockResolvedValue({
        ...mockOrder,
        status: 'CANCELLED',
      });
      mockedAxios.patch.mockResolvedValue({});

      await service.updateStatus('order-1', { status: OrderStatus.CANCELLED });

      expect(mockedAxios.patch).toHaveBeenCalled();
    });
  });

  describe('cancel', () => {
    it('should cancel a pending order', async () => {
      mockPrismaService.order.findFirst.mockResolvedValue(mockOrder);
      mockPrismaService.order.update.mockResolvedValue({
        ...mockOrder,
        status: 'CANCELLED',
      });
      mockedAxios.patch.mockResolvedValue({});

      const result = await service.cancel('order-1', 'user-1');

      expect(result.status).toBe('CANCELLED');
    });

    it('should throw BadRequestException if order cannot be cancelled', async () => {
      mockPrismaService.order.findFirst.mockResolvedValue({
        ...mockOrder,
        status: 'SHIPPED',
      });

      await expect(service.cancel('order-1', 'user-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAllAdmin', () => {
    it('should return all orders for admin', async () => {
      mockPrismaService.order.findMany.mockResolvedValue([mockOrder]);
      mockPrismaService.order.count.mockResolvedValue(1);

      const result = await service.findAllAdmin(1, 10);

      expect(result.data).toEqual([mockOrder]);
    });

    it('should filter by status', async () => {
      mockPrismaService.order.findMany.mockResolvedValue([mockOrder]);
      mockPrismaService.order.count.mockResolvedValue(1);

      await service.findAllAdmin(1, 10, OrderStatus.PENDING);

      expect(mockPrismaService.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: OrderStatus.PENDING },
        }),
      );
    });
  });

  describe('getStats', () => {
    it('should return order statistics', async () => {
      mockPrismaService.order.count
        .mockResolvedValueOnce(100) // total orders
        .mockResolvedValueOnce(10) // pending
        .mockResolvedValueOnce(80); // completed
      mockPrismaService.order.aggregate.mockResolvedValue({
        _sum: { total: new Prisma.Decimal(50000) },
      });

      const result = await service.getStats();

      expect(result.totalOrders).toBe(100);
      expect(result.pendingOrders).toBe(10);
      expect(result.completedOrders).toBe(80);
    });
  });

  describe('status transition validation', () => {
    const transitions = [
      { from: OrderStatus.PENDING, to: OrderStatus.CONFIRMED, valid: true },
      { from: OrderStatus.PENDING, to: OrderStatus.CANCELLED, valid: true },
      { from: OrderStatus.PENDING, to: OrderStatus.SHIPPED, valid: false },
      { from: OrderStatus.CONFIRMED, to: OrderStatus.PROCESSING, valid: true },
      { from: OrderStatus.CONFIRMED, to: OrderStatus.CANCELLED, valid: true },
      { from: OrderStatus.PROCESSING, to: OrderStatus.SHIPPED, valid: true },
      { from: OrderStatus.SHIPPED, to: OrderStatus.DELIVERED, valid: true },
      { from: OrderStatus.SHIPPED, to: OrderStatus.CANCELLED, valid: false },
      { from: OrderStatus.DELIVERED, to: OrderStatus.REFUNDED, valid: true },
      { from: OrderStatus.CANCELLED, to: OrderStatus.PENDING, valid: false },
    ];

    transitions.forEach(({ from, to, valid }) => {
      it(`should ${valid ? 'allow' : 'reject'} transition from ${from} to ${to}`, async () => {
        mockPrismaService.order.findFirst.mockResolvedValue({
          ...mockOrder,
          status: from,
        });

        if (valid) {
          mockPrismaService.order.update.mockResolvedValue({
            ...mockOrder,
            status: to,
          });
          mockedAxios.patch.mockResolvedValue({});

          const result = await service.updateStatus('order-1', { status: to });
          expect(result.status).toBe(to);
        } else {
          await expect(
            service.updateStatus('order-1', { status: to }),
          ).rejects.toThrow(BadRequestException);
        }
      });
    });
  });
});
