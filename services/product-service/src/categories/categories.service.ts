import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../redis/redis.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto';

@Injectable()
export class CategoriesService {
  private readonly logger = new Logger(CategoriesService.name);

  constructor(
    private prisma: PrismaService,
    private redisService: RedisService,
  ) {}

  async create(createCategoryDto: CreateCategoryDto) {
    const existing = await this.prisma.category.findFirst({
      where: {
        OR: [
          { name: createCategoryDto.name },
          { slug: createCategoryDto.slug },
        ],
      },
    });

    if (existing) {
      throw new ConflictException('Category with this name or slug already exists');
    }

    const category = await this.prisma.category.create({
      data: createCategoryDto,
      include: { parent: true, children: true },
    });

    await this.redisService.delPattern('categories:*');

    return category;
  }

  async findAll(includeInactive = false) {
    const cacheKey = `categories:all:${includeInactive}`;
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const where = includeInactive ? {} : { isActive: true };

    const categories = await this.prisma.category.findMany({
      where,
      include: { parent: true, children: true, _count: { select: { products: true } } },
      orderBy: { name: 'asc' },
    });

    await this.redisService.set(cacheKey, JSON.stringify(categories), 600);
    return categories;
  }

  async findOne(id: string) {
    const cacheKey = `category:${id}`;
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const category = await this.prisma.category.findUnique({
      where: { id },
      include: { parent: true, children: true, _count: { select: { products: true } } },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    await this.redisService.set(cacheKey, JSON.stringify(category), 600);
    return category;
  }

  async findBySlug(slug: string) {
    const category = await this.prisma.category.findUnique({
      where: { slug },
      include: { parent: true, children: true, _count: { select: { products: true } } },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return category;
  }

  async update(id: string, updateCategoryDto: UpdateCategoryDto) {
    await this.findOne(id);

    if (updateCategoryDto.name || updateCategoryDto.slug) {
      const existing = await this.prisma.category.findFirst({
        where: {
          AND: [
            { id: { not: id } },
            {
              OR: [
                updateCategoryDto.name ? { name: updateCategoryDto.name } : {},
                updateCategoryDto.slug ? { slug: updateCategoryDto.slug } : {},
              ].filter(o => Object.keys(o).length > 0),
            },
          ],
        },
      });

      if (existing) {
        throw new ConflictException('Category with this name or slug already exists');
      }
    }

    const updated = await this.prisma.category.update({
      where: { id },
      data: updateCategoryDto,
      include: { parent: true, children: true },
    });

    await this.redisService.del(`category:${id}`);
    await this.redisService.delPattern('categories:*');

    return updated;
  }

  async remove(id: string) {
    await this.findOne(id);

    const productsCount = await this.prisma.product.count({
      where: { categoryId: id },
    });

    if (productsCount > 0) {
      throw new ConflictException('Cannot delete category with products');
    }

    const deleted = await this.prisma.category.delete({ where: { id } });

    await this.redisService.del(`category:${id}`);
    await this.redisService.delPattern('categories:*');

    return deleted;
  }

  async getTree() {
    const cacheKey = 'categories:tree';
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const categories = await this.prisma.category.findMany({
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

    await this.redisService.set(cacheKey, JSON.stringify(categories), 600);
    return categories;
  }
}
