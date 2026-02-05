import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';

interface OrderItem {
  name: string;
  quantity: number;
  price: number;
  image?: string;
}

interface OrderConfirmationData {
  email: string;
  firstName: string;
  orderNumber: string;
  orderDate: Date;
  items: OrderItem[];
  subtotal: number;
  shipping: number;
  tax: number;
  discount: number;
  total: number;
  shippingAddress: {
    firstName: string;
    lastName: string;
    address1: string;
    address2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
}

interface ShippingUpdateData {
  email: string;
  firstName: string;
  orderNumber: string;
  status: string;
  trackingNumber?: string;
  trackingUrl?: string;
  estimatedDelivery?: string;
}

interface OrderCancelledData {
  email: string;
  firstName: string;
  orderNumber: string;
  reason?: string;
  refundAmount?: number;
}

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

  async sendOrderConfirmation(data: OrderConfirmationData): Promise<void> {
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

  async sendShippingUpdate(data: ShippingUpdateData): Promise<void> {
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

  async sendOrderCancelled(data: OrderCancelledData): Promise<void> {
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
