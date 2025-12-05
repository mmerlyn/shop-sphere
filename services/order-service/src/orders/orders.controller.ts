import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Headers,
  BadRequestException,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto, UpdateOrderStatusDto, OrderStatus } from './dto';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  create(
    @Headers('x-user-id') userId: string,
    @Body() createOrderDto: CreateOrderDto,
  ) {
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }
    return this.ordersService.create(userId, createOrderDto);
  }

  @Get()
  findAll(
    @Headers('x-user-id') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }
    return this.ordersService.findAll(
      userId,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 10,
    );
  }

  @Get('stats')
  getStats() {
    return this.ordersService.getStats();
  }

  @Get('admin')
  findAllAdmin(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: OrderStatus,
  ) {
    return this.ordersService.findAllAdmin(
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 10,
      status,
    );
  }

  @Get('number/:orderNumber')
  findByOrderNumber(
    @Param('orderNumber') orderNumber: string,
    @Headers('x-user-id') userId?: string,
  ) {
    return this.ordersService.findByOrderNumber(orderNumber, userId);
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @Headers('x-user-id') userId?: string,
  ) {
    return this.ordersService.findOne(id, userId);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() updateStatusDto: UpdateOrderStatusDto,
  ) {
    return this.ordersService.updateStatus(id, updateStatusDto);
  }

  @Post(':id/cancel')
  cancel(
    @Param('id') id: string,
    @Headers('x-user-id') userId: string,
  ) {
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }
    return this.ordersService.cancel(id, userId);
  }
}
