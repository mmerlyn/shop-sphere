import { Controller, Get } from '@nestjs/common';
import { RedisService } from '../database/redis.service';
import { PrismaService } from '../database/prisma.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly redisService: RedisService,
    private readonly prismaService: PrismaService,
  ) {}

  @Get()
  async checkHealth() {
    const redis = await this.checkRedis();
    const database = await this.checkDatabase();

    return {
      status: redis && database ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      services: {
        redis: redis ? 'up' : 'down',
        database: database ? 'up' : 'down',
      },
    };
  }

  @Get('redis')
  async checkRedis() {
    try {
      const result = await this.redisService.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  }

  @Get('database')
  async checkDatabase() {
    try {
      return await this.prismaService.healthCheck();
    } catch {
      return false;
    }
  }
}