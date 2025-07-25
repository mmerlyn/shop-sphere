import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

export interface Product {
  id: string;
  name: string;
  slug: string;
  sku: string;
  price: number;
  salePrice?: number;
  stock: number;
  isActive: boolean;
  brand: string;
  category: string;
  images: string[];
  variants?: ProductVariant[];
}

export interface ProductVariant {
  id: string;
  name: string;
  sku: string;
  price: number;
  stock: number;
  attributes: Record<string, string>;
}

@Injectable()
export class ProductService {
  private readonly logger = new Logger(ProductService.name);
  private readonly productServiceUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.productServiceUrl = this.configService.get<string>('PRODUCT_SERVICE_URL', 'http://product-service:3002');
  }

  async getProductById(productId: string): Promise<Product | null> {
    try {
      this.logger.debug(`Fetching product with ID: ${productId}`);
      
      const response = await firstValueFrom(
        this.httpService.get(`${this.productServiceUrl}/api/v1/products/${productId}`, {
          timeout: 5000,
        }),
      );
      
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to fetch product ${productId}:`, error.message);
      return null;
    }
  }

  async validateProductAvailability(
    productId: string,
    variantId: string | null,
    quantity: number,
  ): Promise<boolean> {
    try {
      this.logger.debug(`Validating availability for product ${productId}, variant ${variantId}, quantity ${quantity}`);
      
      const response = await firstValueFrom(
        this.httpService.post(`${this.productServiceUrl}/api/v1/products/validate-availability`, {
          productId,
          variantId,
          quantity,
        }, {
          timeout: 5000,
        }),
      );
      
      return response.data.available;
    } catch (error) {
      this.logger.error(`Failed to validate product availability:`, error.message);
      return false;
    }
  }

  async reserveStock(items: Array<{ productId: string; variantId?: string; quantity: number }>): Promise<boolean> {
    try {
      this.logger.debug(`Reserving stock for ${items.length} items`);
      
      const response = await firstValueFrom(
        this.httpService.post(`${this.productServiceUrl}/api/v1/products/reserve-stock`, {
          items,
        }, {
          timeout: 10000,
        }),
      );
      
      return response.data.success;
    } catch (error) {
      this.logger.error(`Failed to reserve stock:`, error.message);
      return false;
    }
  }

  async releaseStock(items: Array<{ productId: string; variantId?: string; quantity: number }>): Promise<boolean> {
    try {
      this.logger.debug(`Releasing stock for ${items.length} items`);
      
      const response = await firstValueFrom(
        this.httpService.post(`${this.productServiceUrl}/api/v1/products/release-stock`, {
          items,
        }, {
          timeout: 10000,
        }),
      );
      
      return response.data.success;
    } catch (error) {
      this.logger.error(`Failed to release stock:`, error.message);
      return false;
    }
  }
}
