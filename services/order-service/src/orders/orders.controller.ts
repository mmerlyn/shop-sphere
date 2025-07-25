import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Request,
  HttpStatus,
  ParseUUIDPipe,
  ValidationPipe,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
  ApiExtraModels,
} from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import {
  CreateOrderDto,
  UpdateOrderDto,
  UpdateOrderStatusDto,
  OrderQueryDto,
  OrderResponseDto,
  PaginatedOrdersDto,
  OrderSummaryDto,
} from './dto';
import { OrderStatus, PaymentStatus } from './enums';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

interface AuthenticatedRequest {
  user?: {
    userId: string;
    email: string;
    role: string;
  };
  session?: {
    sessionId: string;
  };
}

@ApiTags('Orders')
@ApiExtraModels(OrderResponseDto, PaginatedOrdersDto)
@Controller('orders')
export class OrdersController {
  private readonly logger = new Logger(OrdersController.name);

  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new order' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Order created successfully',
    type: OrderResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid order data or insufficient stock',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Stock reservation failed',
  })
  async createOrder(
    @Body(ValidationPipe) createOrderDto: CreateOrderDto,
    @Request() req: AuthenticatedRequest,
  ): Promise<OrderResponseDto> {
    this.logger.log(`Creating order for user: ${req.user?.userId || 'guest'}`);

    const userId = req.user?.userId;
    const sessionId = req.session?.sessionId;

    return this.ordersService.createOrder(createOrderDto, userId, sessionId);
  }

  @Get()
  @ApiOperation({ summary: 'Get orders with filtering and pagination' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Orders retrieved successfully',
    type: PaginatedOrdersDto,
  })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page' })
  @ApiQuery({ name: 'status', required: false, enum: OrderStatus, description: 'Order status filter' })
  @ApiQuery({ name: 'paymentStatus', required: false, enum: PaymentStatus, description: 'Payment status filter' })
  @ApiQuery({ name: 'userId', required: false, type: String, description: 'User ID filter (admin only)' })
  @ApiQuery({ name: 'customerEmail', required: false, type: String, description: 'Customer email filter' })
  @ApiQuery({ name: 'orderNumber', required: false, type: String, description: 'Order number search' })
  @ApiQuery({ name: 'dateFrom', required: false, type: String, description: 'Date from (ISO string)' })
  @ApiQuery({ name: 'dateTo', required: false, type: String, description: 'Date to (ISO string)' })
  @ApiQuery({ name: 'sortBy', required: false, type: String, description: 'Sort field' })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'], description: 'Sort order' })
  async getOrders(
    @Query(ValidationPipe) queryDto: OrderQueryDto,
    @Request() req: AuthenticatedRequest,
  ): Promise<PaginatedOrdersDto> {
    this.logger.log(`Fetching orders - page: ${queryDto.page}, limit: ${queryDto.limit}`);

    const userId = req.user?.role === 'admin' ? queryDto.userId : req.user?.userId;

    return this.ordersService.getOrders(queryDto, userId);
  }

  @Get('my/summary')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user order summary and statistics' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Order summary retrieved successfully',
  })
  async getMyOrderSummary(
    @CurrentUser('userId') userId: string,
  ): Promise<{ orders: OrderSummaryDto[]; stats: any }> {
    this.logger.log(`Fetching order summary for user: ${userId}`);
    return this.ordersService.getOrderSummary(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get order by ID' })
  @ApiParam({ name: 'id', description: 'Order ID', type: String })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Order retrieved successfully',
    type: OrderResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Order not found',
  })
  async getOrderById(
    @Param('id', ParseUUIDPipe) orderId: string,
    @Request() req: AuthenticatedRequest,
  ): Promise<OrderResponseDto> {
    this.logger.log(`Fetching order: ${orderId}`);

    const userId = req.user?.role === 'admin' ? undefined : req.user?.userId;

    return this.ordersService.getOrderById(orderId, userId);
  }

  @Get('number/:orderNumber')
  @ApiOperation({ summary: 'Get order by order number' })
  @ApiParam({ name: 'orderNumber', description: 'Order number', type: String })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Order retrieved successfully',
    type: OrderResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Order not found',
  })
  async getOrderByNumber(
    @Param('orderNumber') orderNumber: string,
    @Request() req: AuthenticatedRequest,
  ): Promise<OrderResponseDto> {
    this.logger.log(`Fetching order by number: ${orderNumber}`);

    const userId = req.user?.role === 'admin' ? undefined : req.user?.userId;

    return this.ordersService.getOrderByNumber(orderNumber, userId);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update order details (only for editable orders)' })
  @ApiParam({ name: 'id', description: 'Order ID', type: String })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Order updated successfully',
    type: OrderResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Order not found',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Order cannot be modified in current status',
  })
  async updateOrder(
    @Param('id', ParseUUIDPipe) orderId: string,
    @Body(ValidationPipe) updateOrderDto: UpdateOrderDto,
    @CurrentUser('userId') userId: string,
  ): Promise<OrderResponseDto> {
    this.logger.log(`Updating order: ${orderId}`);
    return this.ordersService.updateOrder(orderId, updateOrderDto, userId);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update order status' })
  @ApiParam({ name: 'id', description: 'Order ID', type: String })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Order status updated successfully',
    type: OrderResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Order not found',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid status transition',
  })
  async updateOrderStatus(
    @Param('id', ParseUUIDPipe) orderId: string,
    @Body(ValidationPipe) updateStatusDto: UpdateOrderStatusDto,
    @CurrentUser('userId') userId: string,
    @Request() req: AuthenticatedRequest,
  ): Promise<OrderResponseDto> {
    this.logger.log(`Updating order ${orderId} status to ${updateStatusDto.status}`);

    const userType = req.user?.role === 'admin' ? 'ADMIN' : 'USER';
    return this.ordersService.updateOrderStatus(orderId, updateStatusDto, userId, userType);
  }

  @Delete(':id/cancel')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cancel an order' })
  @ApiParam({ name: 'id', description: 'Order ID', type: String })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Order cancelled successfully',
    type: OrderResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Order not found',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Order cannot be cancelled in current status',
  })
  async cancelOrder(
    @Param('id', ParseUUIDPipe) orderId: string,
    @Body('reason') reason?: string,
    @CurrentUser('userId') userId?: string,
  ): Promise<OrderResponseDto> {
    this.logger.log(`Cancelling order: ${orderId}`);
    return this.ordersService.cancelOrder(orderId, reason, userId);
  }

  @Get('admin/analytics')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get order analytics (admin only)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Order analytics retrieved successfully',
  })
  async getOrderAnalytics(
    @Query('period') period?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ): Promise<any> {
    this.logger.log('Fetching order analytics');
    return {
      message: 'Order analytics endpoint - implementation needed',
      period,
      dateFrom,
      dateTo,
    };
  }

  @Post('admin/:id/refund')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Process order refund (admin only)' })
  @ApiParam({ name: 'id', description: 'Order ID', type: String })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Refund processed successfully',
  })
  async processRefund(
    @Param('id', ParseUUIDPipe) orderId: string,
    @Body('amount') amount?: number,
    @Body('reason') reason?: string,
  ): Promise<any> {
    this.logger.log(`Processing refund for order: ${orderId}`);
    return {
      message: 'Refund processing endpoint - implementation needed',
      orderId,
      amount,
      reason,
    };
  }
}