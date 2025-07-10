import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';

@Injectable()
export class ConfigService {
  constructor(private nestConfigService: NestConfigService) {}

  get port(): number {
    return this.nestConfigService.get<number>('PORT') || 3001;
  }

  get jwtSecret(): string {
    return this.nestConfigService.get<string>('JWT_SECRET') || 'your-secret-key';
  }

  get jwtExpiresIn(): string {
    return this.nestConfigService.get<string>('JWT_EXPIRES_IN') || '24h';
  }

  get databaseUrl(): string {
    return this.nestConfigService.get<string>('DATABASE_URL') || 
           'postgresql://username:password@localhost:5432/shopsphere_users';
  }

  get nodeEnv(): string {
    return this.nestConfigService.get<string>('NODE_ENV') || 'development';
  }
}