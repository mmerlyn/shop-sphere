import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'ShopSphere Order Service API v1.0 - Visit /api/docs for documentation';
  }
}

