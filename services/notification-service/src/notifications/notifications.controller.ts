import { Controller, Post, Body } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  @Post('welcome')
  async sendWelcome(@Body() data: { firstName: string; email: string }) {
    return this.notificationsService.sendWelcome(data);
  }

  @Post('password-reset')
  async sendPasswordReset(
    @Body() data: { firstName: string; email: string; resetToken: string; resetUrl: string },
  ) {
    return this.notificationsService.sendPasswordReset(data);
  }

  @Post('password-changed')
  async sendPasswordChanged(@Body() data: { firstName: string; email: string }) {
    return this.notificationsService.sendPasswordChanged(data);
  }

  @Post('order-confirmation')
  async sendOrderConfirmation(@Body() data: any) {
    return this.notificationsService.sendOrderConfirmation(data);
  }

  @Post('shipping-update')
  async sendShippingUpdate(@Body() data: any) {
    return this.notificationsService.sendShippingUpdate(data);
  }

  @Post('order-cancelled')
  async sendOrderCancelled(@Body() data: any) {
    return this.notificationsService.sendOrderCancelled(data);
  }
}
