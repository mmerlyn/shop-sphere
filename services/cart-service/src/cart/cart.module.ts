import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';
import { DatabaseModule } from '../database/database.module';
import { ProductModule } from './external/product/product.module';
import { UserModule } from './external/user/user.module';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    ProductModule,
    UserModule,
  ],
  controllers: [CartController],
  providers: [CartService],
  exports: [CartService],
})
export class CartModule {}