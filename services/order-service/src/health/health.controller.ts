import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
  HealthCheckService,
  HttpHealthIndicator,
  PrismaHealthIndicator,
  HealthCheck,
} from '@nestjs/terminus';
import { PrismaService } from '../database/prisma.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private healthCheckService: HealthCheckService,
    private http: HttpHealthIndicator,
    private prismaHealth: PrismaHealthIndicator,
    private prisma: PrismaService,
  ) {}

  @Get()
  @HealthCheck()
  @ApiOperation({ summary: 'Health check endpoint' })
  @ApiResponse({ status: 200, description: 'Health check passed' })
  @ApiResponse({ status: 503, description: 'Health check failed' })
  check() {
    return this.healthCheckService.check([
      () => this.http.pingCheck('nestjs-docs', 'https://nestjs.com'),
      () => this.prismaHealth.pingCheck('database', this.prisma),
    ]);
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe' })
  readiness() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'order-service',
      version: '1.0.0',
    };
  }

  @Get('live')
  @ApiOperation({ summary: 'Liveness probe' })
  liveness() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    };
  }
}
