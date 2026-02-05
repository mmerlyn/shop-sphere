import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { StripeService } from './stripe.service';
import { Prisma } from '../generated/prisma';
import axios from 'axios';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly orderServiceUrl: string;

  constructor(
    private prisma: PrismaService,
    private stripeService: StripeService,
    private configService: ConfigService,
  ) {
    this.orderServiceUrl =
      this.configService.get<string>('ORDER_SERVICE_URL') || 'http://localhost:3004';
  }

  async createPaymentIntent(data: {
    orderId: string;
    userId: string;
    amount: number;
    currency?: string;
  }) {
    if (data.amount <= 0) {
      throw new BadRequestException('Amount must be greater than 0');
    }

    const paymentIntent = await this.stripeService.createPaymentIntent({
      amount: data.amount,
      currency: data.currency,
      metadata: {
        orderId: data.orderId,
        userId: data.userId,
      },
    });

    const payment = await this.prisma.payment.create({
      data: {
        orderId: data.orderId,
        userId: data.userId,
        stripePaymentId: paymentIntent.id,
        amount: new Prisma.Decimal(data.amount),
        currency: data.currency || 'usd',
        status: 'PROCESSING',
        metadata: { paymentIntentId: paymentIntent.id },
      },
    });

    return {
      paymentId: payment.id,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: data.amount,
      currency: payment.currency,
      status: payment.status,
    };
  }

  async confirmPayment(data: { paymentIntentId: string; orderId: string; userId: string }) {
    const paymentIntent = await this.stripeService.retrievePaymentIntent(data.paymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      throw new BadRequestException(`Payment not successful. Status: ${paymentIntent.status}`);
    }

    const payment = await this.prisma.payment.updateMany({
      where: { stripePaymentId: data.paymentIntentId },
      data: { status: 'SUCCEEDED' },
    });

    // Update order status via order-service
    await this.updateOrderStatus(data.orderId, 'CONFIRMED', data.paymentIntentId);

    return {
      success: true,
      paymentIntentId: data.paymentIntentId,
      orderId: data.orderId,
    };
  }

  async handleWebhookEvent(event: any) {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object;
        await this.prisma.payment.updateMany({
          where: { stripePaymentId: paymentIntent.id },
          data: { status: 'SUCCEEDED' },
        });

        const orderId = paymentIntent.metadata?.orderId;
        if (orderId) {
          await this.updateOrderStatus(orderId, 'CONFIRMED', paymentIntent.id);
        }
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object;
        await this.prisma.payment.updateMany({
          where: { stripePaymentId: paymentIntent.id },
          data: {
            status: 'FAILED',
            failureReason: paymentIntent.last_payment_error?.message || 'Payment failed',
          },
        });

        const orderId = paymentIntent.metadata?.orderId;
        if (orderId) {
          await this.updateOrderStatus(orderId, 'CANCELLED', null);
        }
        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object;
        const paymentIntentId = charge.payment_intent as string;
        if (paymentIntentId) {
          const refundedAmount = charge.amount_refunded / 100;
          const totalAmount = charge.amount / 100;
          const status = refundedAmount >= totalAmount ? 'REFUNDED' : 'PARTIALLY_REFUNDED';

          await this.prisma.payment.updateMany({
            where: { stripePaymentId: paymentIntentId },
            data: {
              status,
              refundedAmount: new Prisma.Decimal(refundedAmount),
            },
          });

          if (status === 'REFUNDED') {
            const payment = await this.prisma.payment.findFirst({
              where: { stripePaymentId: paymentIntentId },
            });
            if (payment) {
              await this.updateOrderStatus(payment.orderId, 'REFUNDED', null);
            }
          }
        }
        break;
      }

      default:
        this.logger.log(`Unhandled event type: ${event.type}`);
    }

    return { received: true };
  }

  async refundPayment(paymentId: string, amount?: number) {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (!payment.stripePaymentId) {
      throw new BadRequestException('No Stripe payment to refund');
    }

    const refund = await this.stripeService.refundPayment(payment.stripePaymentId, amount);
    const refundedAmount = amount || Number(payment.amount);

    await this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: refundedAmount >= Number(payment.amount) ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
        refundedAmount: new Prisma.Decimal(refundedAmount),
      },
    });

    return { refundId: refund.id, amount: refundedAmount };
  }

  async findById(id: string) {
    const payment = await this.prisma.payment.findUnique({ where: { id } });
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    return payment;
  }

  async findByOrderId(orderId: string) {
    return this.prisma.payment.findMany({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async updateOrderStatus(orderId: string, status: string, paymentId: string | null) {
    try {
      await axios.patch(`${this.orderServiceUrl}/api/orders/${orderId}/status`, {
        status,
        ...(paymentId && { paymentId }),
      });
      this.logger.log(`Updated order ${orderId} status to ${status}`);
    } catch (error) {
      this.logger.error(`Failed to update order ${orderId} status`, error);
    }
  }
}
