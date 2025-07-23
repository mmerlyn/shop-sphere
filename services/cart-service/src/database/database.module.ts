import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RedisService } from './redis.service';
import { PrismaService } from './prisma.service';
import { ConfigService } from '../config/config.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [RedisService, PrismaService, ConfigService],  
  exports: [RedisService, PrismaService, ConfigService],   
})
export class DatabaseModule {}