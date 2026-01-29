import { Injectable, Logger } from '@nestjs/common';
import { MailService } from '../mail/mail.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private mailService: MailService) {}

  async sendWelcome(data: { firstName: string; email: string }) {
    await this.mailService.sendWelcomeEmail(data);
    return { success: true, type: 'welcome', email: data.email };
  }

  async sendPasswordReset(data: {
    firstName: string;
    email: string;
    resetToken: string;
    resetUrl: string;
  }) {
    await this.mailService.sendPasswordResetEmail(data);
    return { success: true, type: 'password-reset', email: data.email };
  }

  async sendPasswordChanged(data: { firstName: string; email: string }) {
    await this.mailService.sendPasswordChangedEmail(data);
    return { success: true, type: 'password-changed', email: data.email };
  }

  async sendOrderConfirmation(data: {
    email: string;
    firstName: string;
    orderNumber: string;
    orderDate: Date;
    items: Array<{ name: string; quantity: number; price: number; image?: string }>;
    subtotal: number;
    shipping: number;
    tax: number;
    discount: number;
    total: number;
    shippingAddress: any;
  }) {
    await this.mailService.sendOrderConfirmation(data);
    return { success: true, type: 'order-confirmation', orderNumber: data.orderNumber };
  }

  async sendShippingUpdate(data: {
    email: string;
    firstName: string;
    orderNumber: string;
    status: string;
    trackingNumber?: string;
    trackingUrl?: string;
    estimatedDelivery?: string;
  }) {
    await this.mailService.sendShippingUpdate(data);
    return { success: true, type: 'shipping-update', orderNumber: data.orderNumber };
  }

  async sendOrderCancelled(data: {
    email: string;
    firstName: string;
    orderNumber: string;
    reason?: string;
    refundAmount?: number;
  }) {
    await this.mailService.sendOrderCancelled(data);
    return { success: true, type: 'order-cancelled', orderNumber: data.orderNumber };
  }
}
