import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { SearchService } from '../search/search.service';
import { RedisService } from '../redis/redis.service';
import { CreateProductDto, UpdateProductDto, SearchProductDto } from './dto';
import { Prisma } from '../generated/prisma';
import * as crypto from 'crypto';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    private prisma: PrismaService,
    private searchService: SearchService,
    private redisService: RedisService,
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

    await this.redisService.delPattern('products:list:*');
    await this.redisService.delPattern('products:featured:*');

    return product;
  }

  async findAll(params: SearchProductDto) {
    const paramsHash = crypto.createHash('md5').update(JSON.stringify(params)).digest('hex');
    const cacheKey = `products:list:${paramsHash}`;
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

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

      const searchResponse = {
        data: searchResult.hits,
        meta: {
          total: searchResult.total,
          page,
          limit,
          totalPages: Math.ceil(searchResult.total / limit),
        },
      };

      await this.redisService.set(cacheKey, JSON.stringify(searchResponse), 60);
      return searchResponse;
    }

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

    const result = {
      data: products,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };

    await this.redisService.set(cacheKey, JSON.stringify(result), 60);
    return result;
  }

  async findOne(id: string) {
    const cacheKey = `product:${id}`;
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { category: true },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    await this.redisService.set(cacheKey, JSON.stringify(product), 300);
    return product;
  }

  async findBySlug(slug: string) {
    const cacheKey = `product:slug:${slug}`;
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const product = await this.prisma.product.findUnique({
      where: { slug },
      include: { category: true },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    await this.redisService.set(cacheKey, JSON.stringify(product), 300);
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

    await this.redisService.del(`product:${id}`);
    await this.redisService.del(`product:slug:${updated.slug}`);
    await this.redisService.delPattern('products:list:*');
    await this.redisService.delPattern('products:featured:*');

    return updated;
  }

  async remove(id: string) {
    await this.findOne(id);

    const deleted = await this.prisma.product.delete({ where: { id } });

    await this.searchService.deleteProduct(id);

    await this.redisService.del(`product:${id}`);
    await this.redisService.delPattern('product:slug:*');
    await this.redisService.delPattern('products:list:*');
    await this.redisService.delPattern('products:featured:*');

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
    const cacheKey = `products:featured:${limit}`;
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const products = await this.prisma.product.findMany({
      where: { isActive: true, isFeatured: true },
      include: { category: true },
      take: limit,
      orderBy: { createdAt: 'desc' },
    });

    await this.redisService.set(cacheKey, JSON.stringify(products), 120);
    return products;
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
