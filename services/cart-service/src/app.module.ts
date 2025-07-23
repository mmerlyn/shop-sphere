import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CartModule } from './cart/cart.module';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { ConfigService } from './config/config.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    DatabaseModule,
    CartModule,
    HealthModule,
  ],
  providers: [ConfigService],
})
export class AppModule {}