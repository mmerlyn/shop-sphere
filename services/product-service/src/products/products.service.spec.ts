import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ProductsService } from './products.service';
import { Product } from './schemas/product.schema';

describe('ProductsService', () => {
  let service: ProductsService;
  let mockProductModel: any;

  beforeEach(async () => {
    mockProductModel = {
      new: jest.fn(),
      constructor: jest.fn(),
      find: jest.fn(),
      findById: jest.fn(),
      findOne: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      findByIdAndDelete: jest.fn(),
      create: jest.fn(),
      exec: jest.fn(),
      populate: jest.fn(),
      sort: jest.fn(),
      skip: jest.fn(),
      limit: jest.fn(),
      countDocuments: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        {
          provide: getModelToken(Product.name),
          useValue: mockProductModel,
        },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a product', async () => {
      const createProductDto = {
        name: 'Test Product',
        slug: 'test-product',
        description: 'A test product',
        price: 99.99,
        sku: 'TEST-001',
        category: '507f1f77bcf86cd799439011'
      };

      const savedProduct = { ...createProductDto, _id: 'product_id' };
      
      mockProductModel.mockImplementation(() => ({
        save: jest.fn().mockResolvedValue(savedProduct),
      }));

      const result = await service.create(createProductDto as any);
      expect(result).toEqual(savedProduct);
    });
  });
});