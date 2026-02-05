import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private stripe: Stripe;

  constructor(private configService: ConfigService) {
    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY');

    if (!secretKey) {
      this.logger.warn('Stripe secret key not configured - payments will fail');
    }

    this.stripe = new Stripe(secretKey || '', {
      apiVersion: '2025-11-17.clover',
    });
  }

  async createPaymentIntent(params: {
    amount: number;
    currency?: string;
    metadata?: Record<string, string>;
  }): Promise<Stripe.PaymentIntent> {
    const { amount, currency = 'usd', metadata = {} } = params;
    const amountInCents = Math.round(amount * 100);

    try {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: amountInCents,
        currency,
        metadata,
        automatic_payment_methods: { enabled: true },
      });

      this.logger.log(`Created payment intent ${paymentIntent.id} for $${amount}`);
      return paymentIntent;
    } catch (error) {
      this.logger.error('Failed to create payment intent', error);
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Failed to create payment intent',
      );
    }
  }

  async retrievePaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    try {
      return await this.stripe.paymentIntents.retrieve(paymentIntentId);
    } catch (error) {
      this.logger.error(`Failed to retrieve payment intent ${paymentIntentId}`, error);
      throw new BadRequestException('Failed to retrieve payment status');
    }
  }

  async cancelPaymentIntent(paymentIntentId: string): Promise<void> {
    try {
      await this.stripe.paymentIntents.cancel(paymentIntentId);
      this.logger.log(`Cancelled payment intent ${paymentIntentId}`);
    } catch (error) {
      this.logger.error(`Failed to cancel payment intent ${paymentIntentId}`, error);
    }
  }

  async constructWebhookEvent(payload: Buffer, signature: string): Promise<Stripe.Event> {
    const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!webhookSecret) {
      throw new BadRequestException('Webhook secret not configured');
    }

    try {
      return this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (error) {
      this.logger.error('Webhook signature verification failed', error);
      throw new BadRequestException('Webhook signature verification failed');
    }
  }

  async refundPayment(paymentIntentId: string, amount?: number): Promise<Stripe.Refund> {
    try {
      const refundParams: Stripe.RefundCreateParams = {
        payment_intent: paymentIntentId,
      };
      if (amount) {
        refundParams.amount = Math.round(amount * 100);
      }

      const refund = await this.stripe.refunds.create(refundParams);
      this.logger.log(`Created refund ${refund.id} for payment ${paymentIntentId}`);
      return refund;
    } catch (error) {
      this.logger.error(`Failed to refund payment ${paymentIntentId}`, error);
      throw new BadRequestException('Failed to process refund');
    }
  }
}
