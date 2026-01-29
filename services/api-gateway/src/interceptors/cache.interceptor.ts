import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class CacheInterceptor implements NestInterceptor {
  private readonly logger = new Logger(CacheInterceptor.name);
  private readonly cacheTTL = 30; // 30 seconds for gateway cache

  private readonly cacheablePatterns = [
    /^\/api\/products/,
    /^\/api\/categories/,
    /^\/api\/reviews\/product/,
  ];

  constructor(private redisService: RedisService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const { method, originalUrl } = request;

    // Only cache GET requests
    if (method !== 'GET') {
      return next.handle();
    }

    // Only cache matching patterns
    const shouldCache = this.cacheablePatterns.some(pattern => pattern.test(originalUrl));
    if (!shouldCache) {
      return next.handle();
    }

    const cacheKey = `gateway:${originalUrl}`;

    try {
      const cached = await this.redisService.get(cacheKey);
      if (cached) {
        this.logger.debug(`Cache HIT: ${cacheKey}`);
        return of(JSON.parse(cached));
      }
    } catch (error) {
      this.logger.warn('Cache read error', error);
    }

    this.logger.debug(`Cache MISS: ${cacheKey}`);

    return next.handle().pipe(
      tap(async (response) => {
        try {
          await this.redisService.set(cacheKey, JSON.stringify(response), this.cacheTTL);
        } catch (error) {
          this.logger.warn('Cache write error', error);
        }
      }),
    );
  }
}
