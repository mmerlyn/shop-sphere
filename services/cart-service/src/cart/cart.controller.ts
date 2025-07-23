import { 
  Controller, 
  Get, 
  Post, 
  Put, 
  Delete, 
  Body, 
  UseGuards, 
  HttpCode, 
  HttpStatus,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { CartService } from './cart.service';
import { CartAuthGuard } from '../common/guards/cart-auth.guard';
import { UserOrSession, CartUserContext } from '../common/decorators/user-or-session.decorator';
import {
  AddToCartDto,
  AddToCartResponse,
  UpdateCartItemDto,
  RemoveCartItemDto,
  UpdateCartItemResponse,
  CartResponseDto,
  CartSummaryDto,
  ApplyCouponDto,
  CouponResponseDto,
} from './dto';

@Controller('cart')
@UseGuards(CartAuthGuard)
export class CartController {
  private readonly logger = new Logger(CartController.name);

  constructor(private readonly cartService: CartService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async getCart(@UserOrSession() context: CartUserContext): Promise<CartResponseDto> {
    this.logger.log(`Getting cart for user: ${context.userId || 'guest'}`);
    
    return await this.cartService.getCart(context.userId, context.sessionId);
  }

  @Get('summary')
  @HttpCode(HttpStatus.OK)
  async getCartSummary(@UserOrSession() context: CartUserContext): Promise<CartSummaryDto> {
    const summary = await this.cartService.getCartSummary(context.userId, context.sessionId);
    return new CartSummaryDto(summary);
  }

  @Post('items')
  @HttpCode(HttpStatus.CREATED)
  async addToCart(
    @Body() addToCartDto: AddToCartDto,
    @UserOrSession() context: CartUserContext,
  ): Promise<AddToCartResponse> {
    this.logger.log(`Adding item to cart: ${JSON.stringify(addToCartDto)}`);
    
    try {
      const cart = await this.cartService.addToCart(addToCartDto, context.userId, context.sessionId);
      
      return new AddToCartResponse(
        true,
        'Item added to cart successfully',
        cart,
        cart.items.find(item => 
          item.productId === addToCartDto.productId && 
          item.variantId === addToCartDto.variantId
        )
      );
    } catch (error) {
      this.logger.error(`Failed to add item to cart: ${error.message}`);
      throw error;
    }
  }

  @Put('items')
  @HttpCode(HttpStatus.OK)
  async updateCartItem(
    @Body() updateCartItemDto: UpdateCartItemDto,
    @UserOrSession() context: CartUserContext,
  ): Promise<UpdateCartItemResponse> {
    this.logger.log(`Updating cart item: ${JSON.stringify(updateCartItemDto)}`);
    
    try {
      const cart = await this.cartService.updateCartItem(updateCartItemDto, context.userId, context.sessionId);
      
      return new UpdateCartItemResponse(
        true,
        updateCartItemDto.quantity > 0 ? 'Cart item updated successfully' : 'Cart item removed successfully',
        cart
      );
    } catch (error) {
      this.logger.error(`Failed to update cart item: ${error.message}`);
      throw error;
    }
  }

  @Delete('items')
  @HttpCode(HttpStatus.OK)
  async removeCartItem(
    @Body() removeCartItemDto: RemoveCartItemDto,
    @UserOrSession() context: CartUserContext,
  ): Promise<UpdateCartItemResponse> {
    this.logger.log(`Removing cart item: ${JSON.stringify(removeCartItemDto)}`);
    
    try {
      const cart = await this.cartService.removeCartItem(removeCartItemDto, context.userId, context.sessionId);
      
      return new UpdateCartItemResponse(
        true,
        'Item removed from cart successfully',
        cart,
        removeCartItemDto
      );
    } catch (error) {
      this.logger.error(`Failed to remove cart item: ${error.message}`);
      throw error;
    }
  }

  @Delete()
  @HttpCode(HttpStatus.OK)
  async clearCart(@UserOrSession() context: CartUserContext): Promise<UpdateCartItemResponse> {
    this.logger.log(`Clearing cart for user: ${context.userId || 'guest'}`);
    
    try {
      const cart = await this.cartService.clearCart(context.userId, context.sessionId);
      
      return new UpdateCartItemResponse(
        true,
        'Cart cleared successfully',
        cart
      );
    } catch (error) {
      this.logger.error(`Failed to clear cart: ${error.message}`);
      throw error;
    }
  }

  @Post('coupon')
  @HttpCode(HttpStatus.OK)
  async applyCoupon(
    @Body() applyCouponDto: ApplyCouponDto,
    @UserOrSession() context: CartUserContext,
  ): Promise<CouponResponseDto> {
    this.logger.log(`Applying coupon: ${applyCouponDto.couponCode}`);
    
    try {
      const cart = await this.cartService.applyCoupon(applyCouponDto, context.userId, context.sessionId);
      
      return new CouponResponseDto(
        true,
        'Coupon applied successfully',
        applyCouponDto.couponCode,
        cart.discountAmount,
        cart
      );
    } catch (error) {
      this.logger.error(`Failed to apply coupon: ${error.message}`);
      throw error;
    }
  }

  @Delete('coupon')
  @HttpCode(HttpStatus.OK)
  async removeCoupon(@UserOrSession() context: CartUserContext): Promise<CouponResponseDto> {
    this.logger.log(`Removing coupon for user: ${context.userId || 'guest'}`);
    
    try {
      const cart = await this.cartService.removeCoupon(context.userId, context.sessionId);
      
      return new CouponResponseDto(
        true,
        'Coupon removed successfully',
        undefined,
        "0",
        cart
      );
    } catch (error) {
      this.logger.error(`Failed to remove coupon: ${error.message}`);
      throw error;
    }
  }

  @Post('merge')
  @HttpCode(HttpStatus.OK)
  async mergeGuestCart(@UserOrSession() context: CartUserContext): Promise<CartResponseDto> {
    if (!context.userId) {
      throw new BadRequestException('User authentication required for cart merge');
    }

    if (!context.sessionId) {
      throw new BadRequestException('Session ID required for cart merge');
    }

    this.logger.log(`Merging guest cart ${context.sessionId} for user ${context.userId}`);
    
    try {
      return await this.cartService.mergeGuestCart(context.sessionId, context.userId);
    } catch (error) {
      this.logger.error(`Failed to merge guest cart: ${error.message}`);
      throw error;
    }
  }
}