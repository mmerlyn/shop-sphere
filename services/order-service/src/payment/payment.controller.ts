import {
  Controller,
  Post,
  Body,
  Headers,
  Req,
  RawBodyRequest,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';
import { PaymentService } from './payment.service';
import { PrismaService } from '../database/prisma.service';

interface CreatePaymentIntentBody {
  amount: number;
  orderId?: string;
}

@Controller('payments')
export class PaymentController {
  private readonly logger = new Logger(PaymentController.name);

  constructor(
    private readonly paymentService: PaymentService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('create-intent')
  async createPaymentIntent(
    @Headers('x-user-id') userId: string,
    @Body() body: CreatePaymentIntentBody,
  ) {
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }

    const { amount, orderId } = body;

    if (!amount || amount <= 0) {
      throw new BadRequestException('Valid amount is required');
    }

    const result = await this.paymentService.createPaymentIntent({
      amount,
      orderId,
      customerId: userId,
      metadata: {
        userId,
      },
    });

    return {
      clientSecret: result.clientSecret,
      paymentIntentId: result.paymentIntentId,
    };
  }

  @Post('confirm')
  async confirmPayment(
    @Headers('x-user-id') userId: string,
    @Body() body: { paymentIntentId: string; orderId: string },
  ) {
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }

    const { paymentIntentId, orderId } = body;

    if (!paymentIntentId || !orderId) {
      throw new BadRequestException('Payment intent ID and order ID are required');
    }

    // Verify payment status with Stripe
    const paymentIntent = await this.paymentService.confirmPaymentIntent(paymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      throw new BadRequestException(`Payment not successful. Status: ${paymentIntent.status}`);
    }

    // Update order with payment info
    const order = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        paymentId: paymentIntentId,
        status: 'CONFIRMED',
      },
      include: { items: true },
    });

    this.logger.log(`Order ${orderId} confirmed with payment ${paymentIntentId}`);

    return order;
  }

  @Post('webhook')
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    if (!signature) {
      throw new BadRequestException('Missing stripe-signature header');
    }

    const rawBody = req.rawBody;
    if (!rawBody) {
      throw new BadRequestException('Missing raw body');
    }

    const event = await this.paymentService.constructWebhookEvent(rawBody, signature);

    this.logger.log(`Received Stripe webhook: ${event.type}`);

    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object;
        const orderId = paymentIntent.metadata?.orderId;

        if (orderId) {
          await this.prisma.order.update({
            where: { id: orderId },
            data: {
              paymentId: paymentIntent.id,
              status: 'CONFIRMED',
            },
          });
          this.logger.log(`Order ${orderId} confirmed via webhook`);
        }
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object;
        const orderId = paymentIntent.metadata?.orderId;

        if (orderId) {
          await this.prisma.order.update({
            where: { id: orderId },
            data: {
              status: 'CANCELLED',
              notes: 'Payment failed',
            },
          });
          this.logger.log(`Order ${orderId} cancelled due to payment failure`);
        }
        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object;
        const paymentIntentId = charge.payment_intent as string;

        if (paymentIntentId) {
          const order = await this.prisma.order.findFirst({
            where: { paymentId: paymentIntentId },
          });

          if (order) {
            await this.prisma.order.update({
              where: { id: order.id },
              data: { status: 'REFUNDED' },
            });
            this.logger.log(`Order ${order.id} marked as refunded`);
          }
        }
        break;
      }

      default:
        this.logger.log(`Unhandled event type: ${event.type}`);
    }

    return { received: true };
  }
}
