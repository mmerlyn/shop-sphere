import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { RedisService } from './redis/redis.service';

@Controller()
export class AppController {
  constructor(private readonly redis: RedisService) {}

  // Liveness: the process is up. This check ignores Redis, so a Redis outage
  // does not make Kubernetes restart every cart pod.
  @Get('health')
  health() {
    return {
      status: 'ok',
      service: 'cart-service',
      timestamp: new Date().toISOString(),
    };
  }

  // Readiness: every cart operation needs Redis. While Redis is unreachable,
  // this returns 503, so Kubernetes sends cart traffic only to pods that can serve it.
  @Get('health/ready')
  ready() {
    if (!this.redis.isReady()) {
      throw new ServiceUnavailableException({ status: 'not-ready', reason: 'redis unavailable' });
    }
    return { status: 'ready', service: 'cart-service' };
  }
}
