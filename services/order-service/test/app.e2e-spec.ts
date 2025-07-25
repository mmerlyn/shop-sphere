import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
const request = require('supertest');
import { AppModule } from '../src/app.module';

describe('Order Service (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    app.setGlobalPrefix('api/v1', {
      exclude: ['health', 'health/ready', 'health/live'],
    });
    
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Health Checks', () => {
    it('/health (GET)', () => {
      return request(app.getHttpServer())
        .get('/health')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('status');
        });
    });

    it('/health/ready (GET)', () => {
      return request(app.getHttpServer())
        .get('/health/ready')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('status', 'ok');
          expect(res.body).toHaveProperty('service', 'order-service');
        });
    });

    it('/health/live (GET)', () => {
      return request(app.getHttpServer())
        .get('/health/live')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('status', 'ok');
          expect(res.body).toHaveProperty('uptime');
        });
    });
  });

  describe('API Routes', () => {
    it('/api/v1/orders (GET) - should return paginated orders', () => {
      return request(app.getHttpServer())
        .get('/api/v1/orders')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('data');
          expect(res.body).toHaveProperty('total');
          expect(res.body).toHaveProperty('page');
          expect(res.body).toHaveProperty('limit');
          expect(Array.isArray(res.body.data)).toBe(true);
        });
    });

    it('/api/docs (GET) - should return Swagger documentation', () => {
      return request(app.getHttpServer())
        .get('/api/docs')
        .expect(200);
    });
  });
});
