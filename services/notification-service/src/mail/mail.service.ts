import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly frontendUrl: string;

  constructor(
    private mailerService: MailerService,
    private configService: ConfigService,
  ) {
    this.frontendUrl = this.configService.get('FRONTEND_URL') || 'http://localhost:3000';
  }

  async sendWelcomeEmail(data: { firstName: string; email: string }): Promise<void> {
    try {
      await this.mailerService.sendMail({
        to: data.email,
        subject: 'Welcome to ShopSphere!',
        template: 'welcome',
        context: {
          firstName: data.firstName,
          loginUrl: `${this.frontendUrl}/login`,
          shopUrl: this.frontendUrl,
        },
      });
      this.logger.log(`Welcome email sent to ${data.email}`);
    } catch (error) {
      this.logger.error(`Failed to send welcome email to ${data.email}`, error);
    }
  }

  async sendPasswordResetEmail(data: {
    firstName: string;
    email: string;
    resetToken: string;
    resetUrl: string;
  }): Promise<void> {
    try {
      const resetUrl = `${this.frontendUrl}/reset-password?token=${data.resetToken}`;
      await this.mailerService.sendMail({
        to: data.email,
        subject: 'Reset Your Password - ShopSphere',
        template: 'password-reset',
        context: {
          firstName: data.firstName,
          resetUrl,
          expiryTime: '1 hour',
        },
      });
      this.logger.log(`Password reset email sent to ${data.email}`);
    } catch (error) {
      this.logger.error(`Failed to send password reset email to ${data.email}`, error);
    }
  }

  async sendPasswordChangedEmail(data: { firstName: string; email: string }): Promise<void> {
    try {
      await this.mailerService.sendMail({
        to: data.email,
        subject: 'Your Password Has Been Changed - ShopSphere',
        template: 'password-changed',
        context: {
          firstName: data.firstName,
          supportEmail: 'support@shopsphere.com',
        },
      });
      this.logger.log(`Password changed email sent to ${data.email}`);
    } catch (error) {
      this.logger.error(`Failed to send password changed email to ${data.email}`, error);
    }
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
  }): Promise<void> {
    try {
      await this.mailerService.sendMail({
        to: data.email,
        subject: `Order Confirmation #${data.orderNumber} - ShopSphere`,
        template: 'order-confirmation',
        context: {
          ...data,
          orderDate: data.orderDate.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          }),
          orderUrl: `${this.frontendUrl}/account/orders/${data.orderNumber}`,
          shopUrl: this.frontendUrl,
        },
      });
      this.logger.log(`Order confirmation email sent for order ${data.orderNumber}`);
    } catch (error) {
      this.logger.error(`Failed to send order confirmation email for order ${data.orderNumber}`, error);
    }
  }

  async sendShippingUpdate(data: {
    email: string;
    firstName: string;
    orderNumber: string;
    status: string;
    trackingNumber?: string;
    trackingUrl?: string;
    estimatedDelivery?: string;
  }): Promise<void> {
    try {
      await this.mailerService.sendMail({
        to: data.email,
        subject: `Shipping Update for Order #${data.orderNumber} - ShopSphere`,
        template: 'shipping-update',
        context: {
          ...data,
          orderUrl: `${this.frontendUrl}/account/orders/${data.orderNumber}`,
        },
      });
      this.logger.log(`Shipping update email sent for order ${data.orderNumber}`);
    } catch (error) {
      this.logger.error(`Failed to send shipping update email for order ${data.orderNumber}`, error);
    }
  }

  async sendOrderCancelled(data: {
    email: string;
    firstName: string;
    orderNumber: string;
    reason?: string;
    refundAmount?: number;
  }): Promise<void> {
    try {
      await this.mailerService.sendMail({
        to: data.email,
        subject: `Order #${data.orderNumber} Cancelled - ShopSphere`,
        template: 'order-cancelled',
        context: {
          ...data,
          shopUrl: this.frontendUrl,
        },
      });
      this.logger.log(`Order cancelled email sent for order ${data.orderNumber}`);
    } catch (error) {
      this.logger.error(`Failed to send order cancelled email for order ${data.orderNumber}`, error);
    }
  }
}
