import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get('health')
  health() {
    return {
      status: 'ok',
      service: 'cart-service',
      timestamp: new Date().toISOString(),
    };
  }
}
