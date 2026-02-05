import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Headers,
  Query,
} from '@nestjs/common';
import { CartService } from './cart.service';
import { AddItemDto, UpdateItemDto, ApplyCouponDto } from './dto';

@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Post()
  createCart(
    @Headers('x-user-id') userId?: string,
  ) {
    return this.cartService.createCart(userId);
  }

  @Get()
  getOrCreateCart(
    @Query('cartId') cartId?: string,
    @Headers('x-user-id') userId?: string,
  ) {
    return this.cartService.getOrCreateCart(cartId, userId);
  }

  @Get(':cartId')
  getCart(@Param('cartId') cartId: string) {
    return this.cartService.getCart(cartId);
  }

  @Post(':cartId/items')
  addItem(
    @Param('cartId') cartId: string,
    @Body() addItemDto: AddItemDto,
  ) {
    return this.cartService.addItem(cartId, addItemDto);
  }

  @Put(':cartId/items/:productId')
  updateItem(
    @Param('cartId') cartId: string,
    @Param('productId') productId: string,
    @Body() updateItemDto: UpdateItemDto,
  ) {
    return this.cartService.updateItem(cartId, productId, updateItemDto);
  }

  @Delete(':cartId/items/:productId')
  removeItem(
    @Param('cartId') cartId: string,
    @Param('productId') productId: string,
  ) {
    return this.cartService.removeItem(cartId, productId);
  }

  @Delete(':cartId/items')
  clearCart(@Param('cartId') cartId: string) {
    return this.cartService.clearCart(cartId);
  }

  @Delete(':cartId')
  deleteCart(@Param('cartId') cartId: string) {
    return this.cartService.deleteCart(cartId);
  }

  @Post(':cartId/coupon')
  applyCoupon(
    @Param('cartId') cartId: string,
    @Body() applyCouponDto: ApplyCouponDto,
  ) {
    return this.cartService.applyCoupon(cartId, applyCouponDto.code);
  }

  @Delete(':cartId/coupon')
  removeCoupon(@Param('cartId') cartId: string) {
    return this.cartService.removeCoupon(cartId);
  }

  @Post(':cartId/merge')
  mergeGuestCart(
    @Param('cartId') cartId: string,
    @Headers('x-user-id') userId: string,
  ) {
    if (!userId) {
      throw new Error('User ID is required for cart merge');
    }
    return this.cartService.mergeGuestCart(cartId, userId);
  }
}
