import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { OrdersModule } from './orders/orders.module';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';
import { ValidationPipe } from './common/pipes/validation.pipe';
import { AppConfigService } from './config/config.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      cache: true,
      expandVariables: true,
    }),
    DatabaseModule,
    OrdersModule,
    HealthModule,
  ],
  providers: [
    AppConfigService,
    {
      provide: APP_FILTER,
      useClass: PrismaExceptionFilter,
    },
    {
      provide: APP_PIPE,
      useClass: ValidationPipe,
    },
  ],
})
export class AppModule {}