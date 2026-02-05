import {
  Injectable,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

export interface CreatePaymentIntentDto {
  amount: number; // in dollars
  currency?: string;
  orderId?: string;
  customerId?: string;
  metadata?: Record<string, string>;
}

export interface PaymentResult {
  paymentIntentId: string;
  clientSecret: string;
  amount: number;
  currency: string;
  status: string;
}

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
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

  async createPaymentIntent(dto: CreatePaymentIntentDto): Promise<PaymentResult> {
    const { amount, currency = 'usd', orderId, customerId, metadata = {} } = dto;

    if (amount <= 0) {
      throw new BadRequestException('Amount must be greater than 0');
    }

    try {
      // Convert dollars to cents for Stripe
      const amountInCents = Math.round(amount * 100);

      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: amountInCents,
        currency,
        metadata: {
          ...metadata,
          orderId: orderId || '',
          customerId: customerId || '',
        },
        automatic_payment_methods: {
          enabled: true,
        },
      });

      this.logger.log(`Created payment intent ${paymentIntent.id} for $${amount}`);

      return {
        paymentIntentId: paymentIntent.id,
        clientSecret: paymentIntent.client_secret!,
        amount,
        currency,
        status: paymentIntent.status,
      };
    } catch (error) {
      this.logger.error('Failed to create payment intent', error);
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Failed to create payment intent'
      );
    }
  }

  async confirmPaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);
      return paymentIntent;
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
      // Don't throw - cancellation failure shouldn't break the flow
    }
  }

  async constructWebhookEvent(
    payload: Buffer,
    signature: string,
  ): Promise<Stripe.Event> {
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
        refundParams.amount = Math.round(amount * 100); // Convert to cents
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
