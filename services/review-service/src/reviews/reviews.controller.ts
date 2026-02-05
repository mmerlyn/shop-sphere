import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Headers,
  BadRequestException,
} from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto, UpdateReviewDto } from './dto';

@Controller('reviews')
export class ReviewsController {
  constructor(private reviewsService: ReviewsService) {}

  @Post()
  async create(
    @Headers('x-user-id') userId: string,
    @Body() createReviewDto: CreateReviewDto,
  ) {
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }
    return this.reviewsService.create(userId, createReviewDto);
  }

  @Get('product/:productId')
  async findByProduct(
    @Param('productId') productId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
  ) {
    return this.reviewsService.findByProduct(
      productId,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 10,
      sortBy || 'createdAt',
      sortOrder || 'desc',
    );
  }

  @Get('product/:productId/summary')
  async getProductSummary(@Param('productId') productId: string) {
    return this.reviewsService.getProductSummary(productId);
  }

  @Get('user/:userId')
  async findByUser(
    @Param('userId') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.reviewsService.findByUser(
      userId,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 10,
    );
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Headers('x-user-id') userId: string,
    @Body() updateReviewDto: UpdateReviewDto,
  ) {
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }
    return this.reviewsService.update(id, userId, updateReviewDto);
  }

  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @Headers('x-user-id') userId: string,
    @Headers('x-user-role') userRole: string,
  ) {
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }
    return this.reviewsService.remove(id, userId, userRole === 'ADMIN');
  }

  @Post(':id/helpful')
  async markHelpful(
    @Param('id') id: string,
    @Headers('x-user-id') userId: string,
  ) {
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }
    return this.reviewsService.markHelpful(id, userId);
  }
}
