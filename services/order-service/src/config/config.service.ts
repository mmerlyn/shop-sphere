import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';

@Injectable()
export class AppConfigService {
  constructor(private configService: NestConfigService) {}

  get port(): number {
    return this.configService.get<number>('PORT', 3004);
  }

  get databaseUrl(): string {
    return this.configService.get<string>('DATABASE_URL', '');
  }

  get jwtSecret(): string {
    return this.configService.get<string>('JWT_SECRET', 'fallback-secret-key');
  }

  get jwtExpiresIn(): string {
    return this.configService.get<string>('JWT_EXPIRES_IN', '1h');
  }

  get userServiceUrl(): string {
    return this.configService.get<string>('USER_SERVICE_URL', 'http://user-service:3001');
  }

  get productServiceUrl(): string {
    return this.configService.get<string>('PRODUCT_SERVICE_URL', 'http://product-service:3002');
  }

  get cartServiceUrl(): string {
    return this.configService.get<string>('CART_SERVICE_URL', 'http://cart-service:3003');
  }

  get paymentServiceUrl(): string {
    return this.configService.get<string>('PAYMENT_SERVICE_URL', 'http://payment-service:3005');
  }

  get taxRate(): number {
    return this.configService.get<number>('TAX_RATE', 0.08);
  }

  get freeShippingThreshold(): number {
    return this.configService.get<number>('FREE_SHIPPING_THRESHOLD', 100);
  }

  get nodeEnv(): string {
    return this.configService.get<string>('NODE_ENV', 'development');
  }

  get isDevelopment(): boolean {
    return this.nodeEnv === 'development';
  }

  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }
}