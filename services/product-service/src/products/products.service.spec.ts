import { Test, TestingModule } from '@nestjs/testing';
import { ProductsService } from './products.service';
import { PrismaService } from '../database/prisma.service';
import { SearchService } from '../search/search.service';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

describe('ProductsService', () => {
  let service: ProductsService;
  let prismaService: PrismaService;
  let searchService: SearchService;

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
    images: ['image1.jpg', 'image2.jpg'],
    inventory: 100,
    lowStockThreshold: 10,
    isActive: true,
    isFeatured: false,
    tags: ['test', 'product'],
    attributes: { color: 'black' },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPrismaService = {
    product: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
      fields: {
        lowStockThreshold: 'lowStockThreshold',
      },
    },
    category: {
      findUnique: jest.fn(),
    },
  };

  const mockSearchService = {
    isAvailable: jest.fn().mockReturnValue(false),
    indexProduct: jest.fn().mockResolvedValue(undefined),
    updateProduct: jest.fn().mockResolvedValue(undefined),
    deleteProduct: jest.fn().mockResolvedValue(undefined),
    search: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: SearchService, useValue: mockSearchService },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
    prismaService = module.get<PrismaService>(PrismaService);
    searchService = module.get<SearchService>(SearchService);

    // Reset all mocks
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createDto = {
      name: 'New Product',
      description: 'A new product',
      sku: 'NEW-001',
      slug: 'new-product',
      price: 49.99,
      categoryId: 'cat-1',
    };

    it('should create a product successfully', async () => {
      mockPrismaService.product.findFirst.mockResolvedValue(null);
      mockPrismaService.category.findUnique.mockResolvedValue(mockCategory);
      mockPrismaService.product.create.mockResolvedValue({
        ...mockProduct,
        ...createDto,
        price: new Prisma.Decimal(createDto.price),
      });

      const result = await service.create(createDto);

      expect(result).toBeDefined();
      expect(result.name).toBe(createDto.name);
      expect(mockPrismaService.product.create).toHaveBeenCalled();
      expect(mockSearchService.indexProduct).toHaveBeenCalled();
    });

    it('should throw ConflictException if SKU already exists', async () => {
      mockPrismaService.product.findFirst.mockResolvedValue(mockProduct);

      await expect(service.create(createDto)).rejects.toThrow(ConflictException);
    });

    it('should throw BadRequestException if category not found', async () => {
      mockPrismaService.product.findFirst.mockResolvedValue(null);
      mockPrismaService.category.findUnique.mockResolvedValue(null);

      await expect(service.create(createDto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('findOne', () => {
    it('should return a product by id', async () => {
      mockPrismaService.product.findUnique.mockResolvedValue(mockProduct);

      const result = await service.findOne('prod-1');

      expect(result).toEqual(mockProduct);
      expect(mockPrismaService.product.findUnique).toHaveBeenCalledWith({
        where: { id: 'prod-1' },
        include: { category: true },
      });
    });

    it('should throw NotFoundException if product not found', async () => {
      mockPrismaService.product.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findBySlug', () => {
    it('should return a product by slug', async () => {
      mockPrismaService.product.findUnique.mockResolvedValue(mockProduct);

      const result = await service.findBySlug('test-product');

      expect(result).toEqual(mockProduct);
      expect(mockPrismaService.product.findUnique).toHaveBeenCalledWith({
        where: { slug: 'test-product' },
        include: { category: true },
      });
    });

    it('should throw NotFoundException if product not found', async () => {
      mockPrismaService.product.findUnique.mockResolvedValue(null);

      await expect(service.findBySlug('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findBySku', () => {
    it('should return a product by SKU', async () => {
      mockPrismaService.product.findUnique.mockResolvedValue(mockProduct);

      const result = await service.findBySku('TEST-001');

      expect(result).toEqual(mockProduct);
    });

    it('should throw NotFoundException if product not found', async () => {
      mockPrismaService.product.findUnique.mockResolvedValue(null);

      await expect(service.findBySku('NONEXISTENT')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('should return paginated products', async () => {
      const products = [mockProduct];
      mockPrismaService.product.findMany.mockResolvedValue(products);
      mockPrismaService.product.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(result.data).toEqual(products);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(20);
      expect(result.meta.totalPages).toBe(1);
    });

    it('should filter by category', async () => {
      mockPrismaService.product.findMany.mockResolvedValue([mockProduct]);
      mockPrismaService.product.count.mockResolvedValue(1);

      await service.findAll({ category: 'cat-1' });

      expect(mockPrismaService.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ categoryId: 'cat-1' }),
        }),
      );
    });

    it('should filter by brand', async () => {
      mockPrismaService.product.findMany.mockResolvedValue([mockProduct]);
      mockPrismaService.product.count.mockResolvedValue(1);

      await service.findAll({ brand: 'TestBrand' });

      expect(mockPrismaService.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ brand: 'TestBrand' }),
        }),
      );
    });

    it('should filter by price range', async () => {
      mockPrismaService.product.findMany.mockResolvedValue([mockProduct]);
      mockPrismaService.product.count.mockResolvedValue(1);

      await service.findAll({ minPrice: 50, maxPrice: 150 });

      expect(mockPrismaService.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            price: { gte: 50, lte: 150 },
          }),
        }),
      );
    });

    it('should search by query', async () => {
      mockPrismaService.product.findMany.mockResolvedValue([mockProduct]);
      mockPrismaService.product.count.mockResolvedValue(1);
      mockSearchService.isAvailable.mockReturnValue(false);

      await service.findAll({ q: 'test' });

      expect(mockPrismaService.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { name: { contains: 'test', mode: 'insensitive' } },
              { description: { contains: 'test', mode: 'insensitive' } },
            ]),
          }),
        }),
      );
    });

    it('should use Elasticsearch when available and query provided', async () => {
      mockSearchService.isAvailable.mockReturnValue(true);
      mockSearchService.search.mockResolvedValue({
        hits: [mockProduct],
        total: 1,
      });

      const result = await service.findAll({ q: 'test' });

      expect(mockSearchService.search).toHaveBeenCalled();
      expect(result.data).toEqual([mockProduct]);
    });
  });

  describe('update', () => {
    const updateDto = {
      name: 'Updated Product',
      price: 79.99,
    };

    it('should update a product successfully', async () => {
      mockPrismaService.product.findUnique.mockResolvedValue(mockProduct);
      mockPrismaService.product.findFirst.mockResolvedValue(null);
      mockPrismaService.product.update.mockResolvedValue({
        ...mockProduct,
        ...updateDto,
        price: new Prisma.Decimal(updateDto.price),
      });

      const result = await service.update('prod-1', updateDto);

      expect(result.name).toBe(updateDto.name);
      expect(mockSearchService.updateProduct).toHaveBeenCalled();
    });

    it('should throw NotFoundException if product not found', async () => {
      mockPrismaService.product.findUnique.mockResolvedValue(null);

      await expect(service.update('nonexistent', updateDto)).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if SKU already exists on another product', async () => {
      mockPrismaService.product.findUnique.mockResolvedValue(mockProduct);
      mockPrismaService.product.findFirst.mockResolvedValue({ id: 'prod-2', sku: 'EXISTING' });

      await expect(
        service.update('prod-1', { sku: 'EXISTING' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('remove', () => {
    it('should delete a product successfully', async () => {
      mockPrismaService.product.findUnique.mockResolvedValue(mockProduct);
      mockPrismaService.product.delete.mockResolvedValue(mockProduct);

      const result = await service.remove('prod-1');

      expect(result).toEqual(mockProduct);
      expect(mockSearchService.deleteProduct).toHaveBeenCalledWith('prod-1');
    });

    it('should throw NotFoundException if product not found', async () => {
      mockPrismaService.product.findUnique.mockResolvedValue(null);

      await expect(service.remove('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateInventory', () => {
    it('should increase inventory', async () => {
      mockPrismaService.product.findUnique.mockResolvedValue(mockProduct);
      mockPrismaService.product.update.mockResolvedValue({
        ...mockProduct,
        inventory: 150,
      });

      const result = await service.updateInventory('prod-1', 50);

      expect(result.inventory).toBe(150);
      expect(mockPrismaService.product.update).toHaveBeenCalledWith({
        where: { id: 'prod-1' },
        data: { inventory: 150 },
      });
    });

    it('should decrease inventory', async () => {
      mockPrismaService.product.findUnique.mockResolvedValue(mockProduct);
      mockPrismaService.product.update.mockResolvedValue({
        ...mockProduct,
        inventory: 50,
      });

      const result = await service.updateInventory('prod-1', -50);

      expect(result.inventory).toBe(50);
    });

    it('should throw BadRequestException for insufficient inventory', async () => {
      mockPrismaService.product.findUnique.mockResolvedValue(mockProduct);

      await expect(service.updateInventory('prod-1', -150)).rejects.toThrow(BadRequestException);
    });
  });

  describe('getFeatured', () => {
    it('should return featured products', async () => {
      const featuredProducts = [{ ...mockProduct, isFeatured: true }];
      mockPrismaService.product.findMany.mockResolvedValue(featuredProducts);

      const result = await service.getFeatured(5);

      expect(result).toEqual(featuredProducts);
      expect(mockPrismaService.product.findMany).toHaveBeenCalledWith({
        where: { isActive: true, isFeatured: true },
        include: { category: true },
        take: 5,
        orderBy: { createdAt: 'desc' },
      });
    });
  });
});
