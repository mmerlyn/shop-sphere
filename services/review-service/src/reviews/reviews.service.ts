import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { CreateReviewDto, UpdateReviewDto } from './dto';
import axios from 'axios';

@Injectable()
export class ReviewsService {
  private readonly logger = new Logger(ReviewsService.name);
  private readonly orderServiceUrl: string;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    this.orderServiceUrl =
      this.configService.get<string>('ORDER_SERVICE_URL') || 'http://localhost:3004';
  }

  async create(userId: string, createReviewDto: CreateReviewDto) {
    // Check if user already reviewed this product
    const existing = await this.prisma.review.findUnique({
      where: {
        productId_userId: {
          productId: createReviewDto.productId,
          userId,
        },
      },
    });

    if (existing) {
      throw new ConflictException('You have already reviewed this product');
    }

    // Check if user has purchased this product (verified purchase)
    const isVerifiedPurchase = await this.checkVerifiedPurchase(userId, createReviewDto.productId);

    return this.prisma.review.create({
      data: {
        ...createReviewDto,
        userId,
        isVerifiedPurchase,
      },
    });
  }

  async findByProduct(productId: string, page = 1, limit = 10, sortBy = 'createdAt', sortOrder: 'asc' | 'desc' = 'desc') {
    const skip = (page - 1) * limit;

    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where: { productId },
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      this.prisma.review.count({ where: { productId } }),
    ]);

    return {
      data: reviews,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getProductSummary(productId: string) {
    const stats = await this.prisma.review.aggregate({
      where: { productId },
      _avg: { rating: true },
      _count: { id: true },
    });

    const distribution = await this.prisma.review.groupBy({
      by: ['rating'],
      where: { productId },
      _count: { id: true },
    });

    const ratingDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    distribution.forEach((d) => {
      ratingDistribution[d.rating] = d._count.id;
    });

    return {
      productId,
      averageRating: Math.round((stats._avg.rating || 0) * 10) / 10,
      totalReviews: stats._count.id,
      ratingDistribution,
    };
  }

  async findByUser(userId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.review.count({ where: { userId } }),
    ]);

    return {
      data: reviews,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async update(id: string, userId: string, updateReviewDto: UpdateReviewDto) {
    const review = await this.prisma.review.findUnique({ where: { id } });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    if (review.userId !== userId) {
      throw new ForbiddenException('You can only edit your own reviews');
    }

    return this.prisma.review.update({
      where: { id },
      data: updateReviewDto,
    });
  }

  async remove(id: string, userId: string, isAdmin = false) {
    const review = await this.prisma.review.findUnique({ where: { id } });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    if (!isAdmin && review.userId !== userId) {
      throw new ForbiddenException('You can only delete your own reviews');
    }

    return this.prisma.review.delete({ where: { id } });
  }

  async markHelpful(reviewId: string, userId: string) {
    const review = await this.prisma.review.findUnique({ where: { id: reviewId } });
    if (!review) {
      throw new NotFoundException('Review not found');
    }

    if (review.userId === userId) {
      throw new ConflictException('You cannot mark your own review as helpful');
    }

    const existing = await this.prisma.reviewHelpful.findUnique({
      where: {
        reviewId_userId: { reviewId, userId },
      },
    });

    if (existing) {
      // Toggle off
      await this.prisma.reviewHelpful.delete({ where: { id: existing.id } });
      await this.prisma.review.update({
        where: { id: reviewId },
        data: { helpfulCount: { decrement: 1 } },
      });
      return { helpful: false };
    }

    await this.prisma.reviewHelpful.create({
      data: { reviewId, userId },
    });

    await this.prisma.review.update({
      where: { id: reviewId },
      data: { helpfulCount: { increment: 1 } },
    });

    return { helpful: true };
  }

  private async checkVerifiedPurchase(userId: string, productId: string): Promise<boolean> {
    try {
      const response = await axios.get(
        `${this.orderServiceUrl}/api/orders/user/${userId}/has-purchased/${productId}`,
      );
      return response.data?.hasPurchased || false;
    } catch (error) {
      this.logger.warn(`Failed to verify purchase for user ${userId}, product ${productId}`);
      return false;
    }
  }
}
