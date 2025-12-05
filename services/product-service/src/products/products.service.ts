import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { SearchService } from '../search/search.service';
import { CreateProductDto, UpdateProductDto, SearchProductDto } from './dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class ProductsService {
  constructor(
    private prisma: PrismaService,
    private searchService: SearchService,
  ) {}

  async create(createProductDto: CreateProductDto) {
    const existing = await this.prisma.product.findFirst({
      where: {
        OR: [{ sku: createProductDto.sku }, { slug: createProductDto.slug }],
      },
    });

    if (existing) {
      throw new ConflictException('Product with this SKU or slug already exists');
    }

    const category = await this.prisma.category.findUnique({
      where: { id: createProductDto.categoryId },
    });

    if (!category) {
      throw new BadRequestException('Category not found');
    }

    const product = await this.prisma.product.create({
      data: {
        ...createProductDto,
        price: new Prisma.Decimal(createProductDto.price),
        comparePrice: createProductDto.comparePrice
          ? new Prisma.Decimal(createProductDto.comparePrice)
          : null,
      },
      include: { category: true },
    });

    // Index in Elasticsearch
    await this.searchService.indexProduct({
      id: product.id,
      name: product.name,
      description: product.description,
      sku: product.sku,
      slug: product.slug,
      price: Number(product.price),
      categoryId: product.categoryId,
      categoryName: product.category.name,
      brand: product.brand || undefined,
      tags: product.tags,
      isActive: product.isActive,
      isFeatured: product.isFeatured,
      inventory: product.inventory,
      createdAt: product.createdAt,
    });

    return product;
  }

  async findAll(params: SearchProductDto) {
    const {
      q,
      category,
      brand,
      minPrice,
      maxPrice,
      tags,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = params;

    // If Elasticsearch is available and we have a search query, use it
    if (this.searchService.isAvailable() && q) {
      const searchResult = await this.searchService.search({
        q,
        category,
        brand,
        minPrice,
        maxPrice,
        tags: tags ? tags.split(',') : undefined,
        page,
        limit,
        sortBy,
        sortOrder,
      });

      return {
        data: searchResult.hits,
        meta: {
          total: searchResult.total,
          page,
          limit,
          totalPages: Math.ceil(searchResult.total / limit),
        },
      };
    }

    // Fallback to database query
    const where: Prisma.ProductWhereInput = { isActive: true };

    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
      ];
    }

    if (category) {
      where.categoryId = category;
    }

    if (brand) {
      where.brand = brand;
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      where.price = {};
      if (minPrice !== undefined) where.price.gte = minPrice;
      if (maxPrice !== undefined) where.price.lte = maxPrice;
    }

    if (tags) {
      where.tags = { hasSome: tags.split(',') };
    }

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: { category: true },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      data: products,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { category: true },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }

  async findBySlug(slug: string) {
    const product = await this.prisma.product.findUnique({
      where: { slug },
      include: { category: true },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }

  async findBySku(sku: string) {
    const product = await this.prisma.product.findUnique({
      where: { sku },
      include: { category: true },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }

  async update(id: string, updateProductDto: UpdateProductDto) {
    const product = await this.findOne(id);

    if (updateProductDto.sku || updateProductDto.slug) {
      const existing = await this.prisma.product.findFirst({
        where: {
          AND: [
            { id: { not: id } },
            {
              OR: [
                updateProductDto.sku ? { sku: updateProductDto.sku } : {},
                updateProductDto.slug ? { slug: updateProductDto.slug } : {},
              ].filter((o) => Object.keys(o).length > 0),
            },
          ],
        },
      });

      if (existing) {
        throw new ConflictException('Product with this SKU or slug already exists');
      }
    }

    if (updateProductDto.categoryId) {
      const category = await this.prisma.category.findUnique({
        where: { id: updateProductDto.categoryId },
      });

      if (!category) {
        throw new BadRequestException('Category not found');
      }
    }

    const updateData: any = { ...updateProductDto };
    if (updateProductDto.price !== undefined) {
      updateData.price = new Prisma.Decimal(updateProductDto.price);
    }
    if (updateProductDto.comparePrice !== undefined) {
      updateData.comparePrice = new Prisma.Decimal(updateProductDto.comparePrice);
    }

    const updated = await this.prisma.product.update({
      where: { id },
      data: updateData,
      include: { category: true },
    });

    // Update in Elasticsearch
    await this.searchService.updateProduct(id, {
      name: updated.name,
      description: updated.description,
      sku: updated.sku,
      slug: updated.slug,
      price: Number(updated.price),
      categoryId: updated.categoryId,
      categoryName: updated.category.name,
      brand: updated.brand || undefined,
      tags: updated.tags,
      isActive: updated.isActive,
      isFeatured: updated.isFeatured,
      inventory: updated.inventory,
    });

    return updated;
  }

  async remove(id: string) {
    await this.findOne(id);

    const deleted = await this.prisma.product.delete({ where: { id } });

    // Remove from Elasticsearch
    await this.searchService.deleteProduct(id);

    return deleted;
  }

  async updateInventory(id: string, quantity: number) {
    const product = await this.findOne(id);

    const newInventory = product.inventory + quantity;
    if (newInventory < 0) {
      throw new BadRequestException('Insufficient inventory');
    }

    return this.prisma.product.update({
      where: { id },
      data: { inventory: newInventory },
    });
  }

  async getFeatured(limit = 10) {
    return this.prisma.product.findMany({
      where: { isActive: true, isFeatured: true },
      include: { category: true },
      take: limit,
      orderBy: { createdAt: 'desc' },
    });
  }

  async getLowStock() {
    return this.prisma.product.findMany({
      where: {
        isActive: true,
        inventory: { lte: this.prisma.product.fields.lowStockThreshold },
      },
      include: { category: true },
      orderBy: { inventory: 'asc' },
    });
  }
}
