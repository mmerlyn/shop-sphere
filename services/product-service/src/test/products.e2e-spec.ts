import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../app.module';
import { ValidationPipe } from '@nestjs/common';

describe('ProductsController (e2e)', () => {
  let app: INestApplication;
  let categoryId: string;
  let productId: string;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }));
    
    await app.init();

    const categoryResponse = await request(app.getHttpServer())
      .post('/api/v1/categories')
      .send({
        name: 'Test Electronics',
        slug: 'test-electronics',
        description: 'Test category for electronics'
      });
    
    categoryId = categoryResponse.body._id;
  });

  afterEach(async () => {
    await app.close();
  });

  describe('/products (POST)', () => {
    it('should create a product', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/products')
        .send({
          name: 'iPhone 15 Pro',
          slug: 'iphone-15-pro',
          description: 'Latest iPhone with advanced features',
          price: 999.99,
          sku: 'APL-IP15P-128',
          category: categoryId,
          stock: 50,
          brand: 'Apple'
        })
        .expect(201);

      expect(response.body.name).toBe('iPhone 15 Pro');
      expect(response.body.price).toBe(999.99);
      productId = response.body._id;
    });

    it('should fail with invalid data', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/products')
        .send({
          name: 'Invalid Product',
        })
        .expect(400);
    });
  });

  describe('/products (GET)', () => {
    beforeEach(async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/products')
        .send({
          name: 'Test Product',
          slug: 'test-product',
          description: 'A test product',
          price: 99.99,
          sku: 'TEST-001',
          category: categoryId
        });
      productId = response.body._id;
    });

    it('should return all products', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/products')
        .expect(200);

      expect(response.body.products).toBeInstanceOf(Array);
      expect(response.body.totalCount).toBeGreaterThan(0);
    });

    it('should search products', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/products?search=Test')
        .expect(200);

      expect(response.body.products.length).toBeGreaterThan(0);
    });

    it('should filter by category', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/products?category=${categoryId}`)
        .expect(200);

      expect(response.body.products.length).toBeGreaterThan(0);
    });
  });

  describe('/products/:id (GET)', () => {
    beforeEach(async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/products')
        .send({
          name: 'Single Product Test',
          slug: 'single-product-test',
          description: 'A single product for testing',
          price: 199.99,
          sku: 'SINGLE-001',
          category: categoryId
        });
      productId = response.body._id;
    });

    it('should return a single product', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/products/${productId}`)
        .expect(200);

      expect(response.body.name).toBe('Single Product Test');
    });

    it('should return 404 for non-existent product', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/products/507f1f77bcf86cd799439011')
        .expect(404);
    });
  });
});