import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';

@Injectable()
export class ConfigService {
  constructor(private configService: NestConfigService) {}

  get nodeEnv(): string {
    return this.configService.get<string>('NODE_ENV') || 'development';
  }

  get port(): number {
    return this.configService.get<number>('PORT') || 3003;
  }

  get apiPrefix(): string {
    return this.configService.get<string>('API_PREFIX') || 'api/v1';
  }

  get redisConfig() {
    return {
      host: this.configService.get<string>('REDIS_HOST') || 'localhost',
      port: this.configService.get<number>('REDIS_PORT') || 6379,
      db: this.configService.get<number>('REDIS_DB') || 0,
      password: this.configService.get<string>('REDIS_PASSWORD'),
      ttl: this.configService.get<number>('REDIS_TTL') || 86400,
    };
  }

  get databaseUrl(): string {
    return this.configService.get<string>('DATABASE_URL');
  }

  get jwtConfig() {
    return {
      secret: this.configService.get<string>('JWT_SECRET') || 'cart-secret',
      expiresIn: this.configService.get<string>('JWT_EXPIRES_IN') || '7d',
    };
  }

  get userServiceUrl(): string {
    return this.configService.get<string>('USER_SERVICE_URL') || 'http://localhost:3001';
  }

  get productServiceUrl(): string {
    return this.configService.get<string>('PRODUCT_SERVICE_URL') || 'http://localhost:3002';
  }

  get productServiceGrpcUrl(): string {
    return this.configService.get<string>('PRODUCT_SERVICE_GRPC_URL') || 'localhost:50051';
  }

  get cartConfig() {
    return {
      sessionTtl: this.configService.get<number>('CART_SESSION_TTL') || 1800, // 30 minutes
      userTtl: this.configService.get<number>('CART_USER_TTL') || 2592000, // 30 days
      maxItems: this.configService.get<number>('MAX_CART_ITEMS') || 50,
      defaultCurrency: this.configService.get<string>('DEFAULT_CURRENCY') || 'USD',
    };
  }

  get taxConfig() {
    return {
      defaultRate: this.configService.get<number>('DEFAULT_TAX_RATE') || 0.08,
      calculationService: this.configService.get<string>('TAX_CALCULATION_SERVICE') || 'internal',
    };
  }

  get metricsConfig() {
    return {
      enabled: this.configService.get<boolean>('ENABLE_METRICS') || true,
      port: this.configService.get<number>('METRICS_PORT') || 9003,
    };
  }
}