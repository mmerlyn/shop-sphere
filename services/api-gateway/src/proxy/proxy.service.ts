import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosRequestConfig, Method } from 'axios';

@Injectable()
export class ProxyService {
  private serviceUrls: Record<string, string>;

  constructor(private configService: ConfigService) {
    this.serviceUrls = {
      users: this.configService.get<string>('USER_SERVICE_URL') || 'http://localhost:3001',
      products: this.configService.get<string>('PRODUCT_SERVICE_URL') || 'http://localhost:3002',
      cart: this.configService.get<string>('CART_SERVICE_URL') || 'http://localhost:3003',
      orders: this.configService.get<string>('ORDER_SERVICE_URL') || 'http://localhost:3004',
      notifications: this.configService.get<string>('NOTIFICATION_SERVICE_URL') || 'http://localhost:3005',
      payments: this.configService.get<string>('PAYMENT_SERVICE_URL') || 'http://localhost:3006',
      reviews: this.configService.get<string>('REVIEW_SERVICE_URL') || 'http://localhost:3007',
    };
  }

  async forward(
    service: string,
    path: string,
    method: Method,
    body?: any,
    headers?: Record<string, string>,
    query?: Record<string, any>,
  ) {
    const baseUrl = this.serviceUrls[service];

    if (!baseUrl) {
      throw new HttpException(
        `Unknown service: ${service}`,
        HttpStatus.BAD_GATEWAY,
      );
    }

    // Strip query string from path since we pass query params separately
    const pathWithoutQuery = path.split('?')[0];
    const url = `${baseUrl}${pathWithoutQuery}`;

    const config: AxiosRequestConfig = {
      method,
      url,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      params: query,
    };

    if (body && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
      config.data = body;
    }

    try {
      const response = await axios(config);
      return response.data;
    } catch (error: any) {
      if (error.response) {
        throw new HttpException(
          error.response.data || 'Service error',
          error.response.status || HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      if (error.code === 'ECONNREFUSED') {
        throw new HttpException(
          `Service ${service} is unavailable`,
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      throw new HttpException(
        'Internal gateway error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  getServiceUrl(service: string): string | undefined {
    return this.serviceUrls[service];
  }
}
