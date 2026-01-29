import { Test, TestingModule } from '@nestjs/testing';
import { CategoriesService } from './categories.service';
import { PrismaService } from '../database/prisma.service';
import { NotFoundException, ConflictException } from '@nestjs/common';

describe('CategoriesService', () => {
  let service: CategoriesService;
  let prismaService: PrismaService;

  const mockCategory = {
    id: 'cat-1',
    name: 'Electronics',
    slug: 'electronics',
    description: 'Electronic devices',
    parentId: null,
    parent: null,
    children: [],
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    _count: { products: 5 },
  };

  const mockChildCategory = {
    id: 'cat-2',
    name: 'Smartphones',
    slug: 'smartphones',
    description: 'Mobile phones',
    parentId: 'cat-1',
    parent: mockCategory,
    children: [],
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    _count: { products: 10 },
  };

  const mockPrismaService = {
    category: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    product: {
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriesService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<CategoriesService>(CategoriesService);
    prismaService = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createDto = {
      name: 'New Category',
      slug: 'new-category',
      description: 'A new category',
    };

    it('should create a category successfully', async () => {
      mockPrismaService.category.findFirst.mockResolvedValue(null);
      mockPrismaService.category.create.mockResolvedValue({
        ...mockCategory,
        ...createDto,
      });

      const result = await service.create(createDto);

      expect(result).toBeDefined();
      expect(result.name).toBe(createDto.name);
      expect(mockPrismaService.category.create).toHaveBeenCalledWith({
        data: createDto,
        include: { parent: true, children: true },
      });
    });

    it('should throw ConflictException if name already exists', async () => {
      mockPrismaService.category.findFirst.mockResolvedValue(mockCategory);

      await expect(service.create(createDto)).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException if slug already exists', async () => {
      mockPrismaService.category.findFirst.mockResolvedValue(mockCategory);

      await expect(service.create({ ...createDto, name: 'Different', slug: 'electronics' }))
        .rejects.toThrow(ConflictException);
    });

    it('should create a subcategory with parent', async () => {
      const subcategoryDto = {
        name: 'Laptops',
        slug: 'laptops',
        description: 'Laptop computers',
        parentId: 'cat-1',
      };

      mockPrismaService.category.findFirst.mockResolvedValue(null);
      mockPrismaService.category.create.mockResolvedValue({
        ...mockChildCategory,
        ...subcategoryDto,
      });

      const result = await service.create(subcategoryDto);

      expect(result.parentId).toBe('cat-1');
    });
  });

  describe('findAll', () => {
    it('should return all active categories', async () => {
      const categories = [mockCategory, mockChildCategory];
      mockPrismaService.category.findMany.mockResolvedValue(categories);

      const result = await service.findAll();

      expect(result).toEqual(categories);
      expect(mockPrismaService.category.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        include: { parent: true, children: true, _count: { select: { products: true } } },
        orderBy: { name: 'asc' },
      });
    });

    it('should return all categories including inactive when specified', async () => {
      const categories = [mockCategory];
      mockPrismaService.category.findMany.mockResolvedValue(categories);

      const result = await service.findAll(true);

      expect(mockPrismaService.category.findMany).toHaveBeenCalledWith({
        where: {},
        include: { parent: true, children: true, _count: { select: { products: true } } },
        orderBy: { name: 'asc' },
      });
    });
  });

  describe('findOne', () => {
    it('should return a category by id', async () => {
      mockPrismaService.category.findUnique.mockResolvedValue(mockCategory);

      const result = await service.findOne('cat-1');

      expect(result).toEqual(mockCategory);
      expect(mockPrismaService.category.findUnique).toHaveBeenCalledWith({
        where: { id: 'cat-1' },
        include: { parent: true, children: true, _count: { select: { products: true } } },
      });
    });

    it('should throw NotFoundException if category not found', async () => {
      mockPrismaService.category.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findBySlug', () => {
    it('should return a category by slug', async () => {
      mockPrismaService.category.findUnique.mockResolvedValue(mockCategory);

      const result = await service.findBySlug('electronics');

      expect(result).toEqual(mockCategory);
      expect(mockPrismaService.category.findUnique).toHaveBeenCalledWith({
        where: { slug: 'electronics' },
        include: { parent: true, children: true, _count: { select: { products: true } } },
      });
    });

    it('should throw NotFoundException if category not found', async () => {
      mockPrismaService.category.findUnique.mockResolvedValue(null);

      await expect(service.findBySlug('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const updateDto = {
      name: 'Updated Electronics',
      description: 'Updated description',
    };

    it('should update a category successfully', async () => {
      mockPrismaService.category.findUnique.mockResolvedValue(mockCategory);
      mockPrismaService.category.findFirst.mockResolvedValue(null);
      mockPrismaService.category.update.mockResolvedValue({
        ...mockCategory,
        ...updateDto,
      });

      const result = await service.update('cat-1', updateDto);

      expect(result.name).toBe(updateDto.name);
      expect(mockPrismaService.category.update).toHaveBeenCalledWith({
        where: { id: 'cat-1' },
        data: updateDto,
        include: { parent: true, children: true },
      });
    });

    it('should throw NotFoundException if category not found', async () => {
      mockPrismaService.category.findUnique.mockResolvedValue(null);

      await expect(service.update('nonexistent', updateDto)).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if name already exists on another category', async () => {
      mockPrismaService.category.findUnique.mockResolvedValue(mockCategory);
      mockPrismaService.category.findFirst.mockResolvedValue({ id: 'cat-2', name: 'Existing' });

      await expect(
        service.update('cat-1', { name: 'Existing' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException if slug already exists on another category', async () => {
      mockPrismaService.category.findUnique.mockResolvedValue(mockCategory);
      mockPrismaService.category.findFirst.mockResolvedValue({ id: 'cat-2', slug: 'existing-slug' });

      await expect(
        service.update('cat-1', { slug: 'existing-slug' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('remove', () => {
    it('should delete a category successfully', async () => {
      mockPrismaService.category.findUnique.mockResolvedValue(mockCategory);
      mockPrismaService.product.count.mockResolvedValue(0);
      mockPrismaService.category.delete.mockResolvedValue(mockCategory);

      const result = await service.remove('cat-1');

      expect(result).toEqual(mockCategory);
      expect(mockPrismaService.category.delete).toHaveBeenCalledWith({
        where: { id: 'cat-1' },
      });
    });

    it('should throw NotFoundException if category not found', async () => {
      mockPrismaService.category.findUnique.mockResolvedValue(null);

      await expect(service.remove('nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if category has products', async () => {
      mockPrismaService.category.findUnique.mockResolvedValue(mockCategory);
      mockPrismaService.product.count.mockResolvedValue(5);

      await expect(service.remove('cat-1')).rejects.toThrow(ConflictException);
    });
  });

  describe('getTree', () => {
    it('should return category tree structure', async () => {
      const categoryTree = [
        {
          ...mockCategory,
          children: [mockChildCategory],
        },
      ];
      mockPrismaService.category.findMany.mockResolvedValue(categoryTree);

      const result = await service.getTree();

      expect(result).toEqual(categoryTree);
      expect(mockPrismaService.category.findMany).toHaveBeenCalledWith({
        where: { isActive: true, parentId: null },
        include: {
          children: {
            where: { isActive: true },
            include: {
              children: { where: { isActive: true } },
            },
          },
        },
        orderBy: { name: 'asc' },
      });
    });

    it('should return empty array when no categories exist', async () => {
      mockPrismaService.category.findMany.mockResolvedValue([]);

      const result = await service.getTree();

      expect(result).toEqual([]);
    });
  });
});
