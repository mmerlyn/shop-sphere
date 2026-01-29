import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class PerformanceInterceptor implements NestInterceptor {
  private readonly logger = new Logger('Performance');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const { method, originalUrl } = request;
    const startTime = Date.now();

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - startTime;
        const statusCode = response.statusCode;

        response.setHeader('X-Response-Time', `${duration}ms`);

        if (duration > 100) {
          this.logger.warn(`${method} ${originalUrl} - ${statusCode} - ${duration}ms [SLOW]`);
        } else {
          this.logger.log(`${method} ${originalUrl} - ${statusCode} - ${duration}ms`);
        }
      }),
    );
  }
}
