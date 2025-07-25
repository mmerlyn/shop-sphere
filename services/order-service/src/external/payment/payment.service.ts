import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

export interface PaymentRequest {
  orderId: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  customerEmail: string;
  customerName: string;
  description: string;
  billingAddress?: {
    firstName: string;
    lastName: string;
    address1: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  metadata?: Record<string, any>;
}

export interface PaymentResponse {
  paymentId: string;
  status: 'success' | 'pending' | 'failed' | 'requires_action';
  transactionId?: string;
  message?: string;
  clientSecret?: string;
  nextAction?: {
    type: string;
    redirectUrl?: string;
  };
}

export interface RefundRequest {
  paymentId: string;
  amount?: number;
  reason?: string;
  metadata?: Record<string, any>;
}

export interface RefundResponse {
  refundId: string;
  status: 'success' | 'pending' | 'failed';
  amount: number;
  message?: string;
}

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private readonly paymentServiceUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.paymentServiceUrl = this.configService.get<string>('PAYMENT_SERVICE_URL', 'http://payment-service:3005');
  }

  async processPayment(paymentRequest: PaymentRequest): Promise<PaymentResponse> {
    try {
      this.logger.debug(`Processing payment for order: ${paymentRequest.orderId}`);
      
      const response = await firstValueFrom(
        this.httpService.post(`${this.paymentServiceUrl}/api/v1/payments/process`, paymentRequest, {
          timeout: 30000,
        }),
      );
      
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to process payment for order ${paymentRequest.orderId}:`, error.message);
      return {
        paymentId: '',
        status: 'failed',
        message: error.response?.data?.message || error.message,
      };
    }
  }

  async refundPayment(refundRequest: RefundRequest): Promise<RefundResponse> {
    try {
      this.logger.debug(`Refunding payment: ${refundRequest.paymentId}`);
      
      const response = await firstValueFrom(
        this.httpService.post(`${this.paymentServiceUrl}/api/v1/payments/${refundRequest.paymentId}/refund`, {
          amount: refundRequest.amount,
          reason: refundRequest.reason,
          metadata: refundRequest.metadata,
        }, {
          timeout: 15000,
        }),
      );
      
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to refund payment ${refundRequest.paymentId}:`, error.message);
      return {
        refundId: '',
        status: 'failed',
        amount: 0,
        message: error.response?.data?.message || error.message,
      };
    }
  }

  async getPaymentStatus(paymentId: string): Promise<string> {
    try {
      this.logger.debug(`Getting payment status: ${paymentId}`);
      
      const response = await firstValueFrom(
        this.httpService.get(`${this.paymentServiceUrl}/api/v1/payments/${paymentId}/status`, {
          timeout: 5000,
        }),
      );
      
      return response.data.status;
    } catch (error) {
      this.logger.error(`Failed to get payment status ${paymentId}:`, error.message);
      return 'unknown';
    }
  }
}
