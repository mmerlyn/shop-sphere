import { Test, TestingModule } from '@nestjs/testing';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { Prisma } from '@prisma/client';

describe('ProductsController', () => {
  let controller: ProductsController;
  let service: ProductsService;

  const mockCategory = {
    id: 'cat-1',
    name: 'Electronics',
    slug: 'electronics',
    description: 'Electronic devices',
    parentId: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockProduct = {
    id: 'prod-1',
    name: 'Test Product',
    description: 'A test product',
    sku: 'TEST-001',
    slug: 'test-product',
    price: new Prisma.Decimal(99.99),
    comparePrice: new Prisma.Decimal(129.99),
    categoryId: 'cat-1',
    category: mockCategory,
    brand: 'TestBrand',
    images: ['image1.jpg'],
    inventory: 100,
    lowStockThreshold: 10,
    isActive: true,
    isFeatured: true,
    tags: ['test'],
    attributes: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockProductsService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    findBySlug: jest.fn(),
    findBySku: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    updateInventory: jest.fn(),
    getFeatured: jest.fn(),
    getLowStock: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductsController],
      providers: [
        { provide: ProductsService, useValue: mockProductsService },
      ],
    }).compile();

    controller = module.get<ProductsController>(ProductsController);
    service = module.get<ProductsService>(ProductsService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a product', async () => {
      const createDto = {
        name: 'New Product',
        description: 'Description',
        sku: 'NEW-001',
        slug: 'new-product',
        price: 49.99,
        categoryId: 'cat-1',
      };

      mockProductsService.create.mockResolvedValue(mockProduct);

      const result = await controller.create(createDto);

      expect(result).toEqual(mockProduct);
      expect(service.create).toHaveBeenCalledWith(createDto);
    });
  });

  describe('findAll', () => {
    it('should return paginated products', async () => {
      const paginatedResult = {
        data: [mockProduct],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      };
      mockProductsService.findAll.mockResolvedValue(paginatedResult);

      const result = await controller.findAll({ page: 1, limit: 20 });

      expect(result).toEqual(paginatedResult);
      expect(service.findAll).toHaveBeenCalledWith({ page: 1, limit: 20 });
    });

    it('should pass search parameters to service', async () => {
      const searchDto = {
        q: 'test',
        category: 'cat-1',
        brand: 'TestBrand',
        minPrice: 10,
        maxPrice: 100,
      };

      mockProductsService.findAll.mockResolvedValue({ data: [], meta: {} });

      await controller.findAll(searchDto);

      expect(service.findAll).toHaveBeenCalledWith(searchDto);
    });
  });

  describe('findOne', () => {
    it('should return a product by id', async () => {
      mockProductsService.findOne.mockResolvedValue(mockProduct);

      const result = await controller.findOne('prod-1');

      expect(result).toEqual(mockProduct);
      expect(service.findOne).toHaveBeenCalledWith('prod-1');
    });
  });

  describe('findBySlug', () => {
    it('should return a product by slug', async () => {
      mockProductsService.findBySlug.mockResolvedValue(mockProduct);

      const result = await controller.findBySlug('test-product');

      expect(result).toEqual(mockProduct);
      expect(service.findBySlug).toHaveBeenCalledWith('test-product');
    });
  });

  describe('findBySku', () => {
    it('should return a product by SKU', async () => {
      mockProductsService.findBySku.mockResolvedValue(mockProduct);

      const result = await controller.findBySku('TEST-001');

      expect(result).toEqual(mockProduct);
      expect(service.findBySku).toHaveBeenCalledWith('TEST-001');
    });
  });

  describe('update', () => {
    it('should update a product', async () => {
      const updateDto = { name: 'Updated Product' };
      const updatedProduct = { ...mockProduct, name: 'Updated Product' };

      mockProductsService.update.mockResolvedValue(updatedProduct);

      const result = await controller.update('prod-1', updateDto);

      expect(result).toEqual(updatedProduct);
      expect(service.update).toHaveBeenCalledWith('prod-1', updateDto);
    });
  });

  describe('remove', () => {
    it('should delete a product', async () => {
      mockProductsService.remove.mockResolvedValue(mockProduct);

      const result = await controller.remove('prod-1');

      expect(result).toEqual(mockProduct);
      expect(service.remove).toHaveBeenCalledWith('prod-1');
    });
  });

  describe('updateInventory', () => {
    it('should update product inventory', async () => {
      const updatedProduct = { ...mockProduct, inventory: 150 };
      mockProductsService.updateInventory.mockResolvedValue(updatedProduct);

      const result = await controller.updateInventory('prod-1', 50);

      expect(result).toEqual(updatedProduct);
      expect(service.updateInventory).toHaveBeenCalledWith('prod-1', 50);
    });
  });

  describe('getFeatured', () => {
    it('should return featured products with default limit', async () => {
      const featuredProducts = [mockProduct];
      mockProductsService.getFeatured.mockResolvedValue(featuredProducts);

      const result = await controller.getFeatured();

      expect(result).toEqual(featuredProducts);
      expect(service.getFeatured).toHaveBeenCalledWith(10);
    });

    it('should return featured products with custom limit', async () => {
      const featuredProducts = [mockProduct];
      mockProductsService.getFeatured.mockResolvedValue(featuredProducts);

      const result = await controller.getFeatured('5');

      expect(result).toEqual(featuredProducts);
      expect(service.getFeatured).toHaveBeenCalledWith(5);
    });
  });

  describe('getLowStock', () => {
    it('should return low stock products', async () => {
      const lowStockProducts = [{ ...mockProduct, inventory: 5 }];
      mockProductsService.getLowStock.mockResolvedValue(lowStockProducts);

      const result = await controller.getLowStock();

      expect(result).toEqual(lowStockProducts);
      expect(service.getLowStock).toHaveBeenCalled();
    });
  });
});
