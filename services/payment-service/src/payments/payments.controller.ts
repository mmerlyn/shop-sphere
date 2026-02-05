import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Headers,
  Req,
  RawBodyRequest,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';
import { PaymentsService } from './payments.service';
import { StripeService } from './stripe.service';

@Controller('payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(
    private paymentsService: PaymentsService,
    private stripeService: StripeService,
  ) {}

  @Post('create-intent')
  async createPaymentIntent(
    @Headers('x-user-id') userId: string,
    @Body() body: { amount: number; orderId: string; currency?: string },
  ) {
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }
    if (!body.amount || body.amount <= 0) {
      throw new BadRequestException('Valid amount is required');
    }

    return this.paymentsService.createPaymentIntent({
      orderId: body.orderId,
      userId,
      amount: body.amount,
      currency: body.currency,
    });
  }

  @Post('confirm')
  async confirmPayment(
    @Headers('x-user-id') userId: string,
    @Body() body: { paymentIntentId: string; orderId: string },
  ) {
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }
    if (!body.paymentIntentId || !body.orderId) {
      throw new BadRequestException('Payment intent ID and order ID are required');
    }

    return this.paymentsService.confirmPayment({
      paymentIntentId: body.paymentIntentId,
      orderId: body.orderId,
      userId,
    });
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

    const event = await this.stripeService.constructWebhookEvent(rawBody, signature);
    this.logger.log(`Received Stripe webhook: ${event.type}`);

    return this.paymentsService.handleWebhookEvent(event);
  }

  @Post(':id/refund')
  async refundPayment(
    @Param('id') id: string,
    @Body() body: { amount?: number },
  ) {
    return this.paymentsService.refundPayment(id, body.amount);
  }

  @Get(':id')
  async getPayment(@Param('id') id: string) {
    return this.paymentsService.findById(id);
  }

  @Get('order/:orderId')
  async getPaymentsByOrder(@Param('orderId') orderId: string) {
    return this.paymentsService.findByOrderId(orderId);
  }
}
