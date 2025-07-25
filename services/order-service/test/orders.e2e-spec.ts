import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
const request = require('supertest');
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { OrderStatus, PaymentStatus } from '../src/orders/enums';

describe('OrdersController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = moduleFixture.get<PrismaService>(PrismaService);

    app.setGlobalPrefix('api/v1', {
      exclude: ['health', 'health/ready', 'health/live'],
    });
    
    await app.init();
  });

  afterEach(async () => {
    try {
      await prisma.orderStatusHistory.deleteMany();
      await prisma.orderItem.deleteMany();
      await prisma.order.deleteMany();
    } catch (error) {
      console.log('Cleanup error:', error);
    }
    await app.close();
  });

  describe('/orders (POST)', () => {
    it('should create a new order with direct items', async () => {
      const orderData = {
        customerEmail: 'test@example.com',
        customerPhone: '+1234567890',
        shippingAddress: {
          firstName: 'Test',
          lastName: 'User',
          address1: '123 Test St',
          city: 'Test City',
          state: 'TS',
          postalCode: '12345',
          country: 'US'
        },
        billingAddress: {
          firstName: 'Test',
          lastName: 'User',
          address1: '123 Test St',
          city: 'Test City',
          state: 'TS',
          postalCode: '12345',
          country: 'US'
        },
        items: [
          {
            productId: 'test-product-1',
            quantity: 2,
            unitPrice: 29.99
          }
        ],
        fromCart: false
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/orders')
        .send(orderData)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('orderNumber');
      expect(response.body.status).toBe(OrderStatus.PENDING);
      expect(response.body.paymentStatus).toBe(PaymentStatus.PENDING);
      expect(response.body.customerEmail).toBe(orderData.customerEmail);
      expect(response.body.items).toHaveLength(1);
    });

    it('should validate required fields', async () => {
      const invalidOrderData = {
        customerEmail: 'invalid-email'
      };

      await request(app.getHttpServer())
        .post('/api/v1/orders')
        .send(invalidOrderData)
        .expect(400);
    });
  });

  describe('/orders (GET)', () => {
    it('should return paginated orders', async () => {
      await prisma.order.create({
        data: {
          status: OrderStatus.PENDING,
          paymentStatus: PaymentStatus.PENDING,
          subtotal: 100,
          taxAmount: 8,
          shippingCost: 10,
          discountAmount: 0,
          totalAmount: 118,
          customerEmail: 'test@example.com',
          shippingAddress: {
            firstName: 'Test',
            lastName: 'User',
            address1: '123 Test St',
            city: 'Test City',
            state: 'TS',
            postalCode: '12345',
            country: 'US'
          },
          billingAddress: {
            firstName: 'Test',
            lastName: 'User',
            address1: '123 Test St',
            city: 'Test City',
            state: 'TS',
            postalCode: '12345',
            country: 'US'
          }
        }
      });

      const response = await request(app.getHttpServer())
        .get('/api/v1/orders')
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('page');
      expect(response.body).toHaveProperty('limit');
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.total).toBeGreaterThanOrEqual(1);
    });
  });

  describe('/orders/:id (GET)', () => {
    it('should return a specific order', async () => {
      const order = await prisma.order.create({
        data: {
          status: OrderStatus.PENDING,
          paymentStatus: PaymentStatus.PENDING,
          subtotal: 100,
          taxAmount: 8,
          shippingCost: 10,
          discountAmount: 0,
          totalAmount: 118,
          customerEmail: 'test@example.com',
          shippingAddress: {
            firstName: 'Test',
            lastName: 'User',
            address1: '123 Test St',
            city: 'Test City',
            state: 'TS',
            postalCode: '12345',
            country: 'US'
          },
          billingAddress: {
            firstName: 'Test',
            lastName: 'User',
            address1: '123 Test St',
            city: 'Test City',
            state: 'TS',
            postalCode: '12345',
            country: 'US'
          },
          items: {
            create: [{
              productId: 'test-product',
              productName: 'Test Product',
              unitPrice: 100,
              quantity: 1,
              totalPrice: 100
            }]
          }
        },
        include: { items: true }
      });

      const response = await request(app.getHttpServer())
        .get(`/api/v1/orders/${order.id}`)
        .expect(200);

      expect(response.body.id).toBe(order.id);
      expect(response.body.orderNumber).toBe(order.orderNumber);
      expect(response.body.items).toHaveLength(1);
    });

    it('should return 404 for non-existent order', async () => {
      const fakeId = '550e8400-e29b-41d4-a716-446655440000';
      
      await request(app.getHttpServer())
        .get(`/api/v1/orders/${fakeId}`)
        .expect(404);
    });
  });
});