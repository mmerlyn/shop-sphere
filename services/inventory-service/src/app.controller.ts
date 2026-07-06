import { Controller, Get } from '@nestjs/common';
import { PrismaService } from './database/prisma.service';

@Controller()
export class AppController {
  constructor(private readonly prisma: PrismaService) {}

  // Liveness: process is up and serving.
  @Get('health')
  health() {
    return {
      status: 'ok',
      service: 'inventory-service',
      timestamp: new Date().toISOString(),
    };
  }

  // Readiness: only route traffic here once the DB is reachable.
  @Get('health/ready')
  async ready() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ready', service: 'inventory-service' };
    } catch (e) {
      return { status: 'not-ready', service: 'inventory-service' };
    }
  }
}
