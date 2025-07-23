import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '../../../config/config.service';
import { firstValueFrom } from 'rxjs';

export interface ProductInfo {
  id: string;
  name: string;
  sku?: string;
  price: number;
  images?: string[];
  category?: string;
  brand?: string;
  inStock: boolean;
  availableQuantity?: number;
  variants?: ProductVariant[];
}

export interface ProductVariant {
  id: string;
  name: string;
  sku?: string;
  price: number;
  inStock: boolean;
  availableQuantity?: number;
  attributes: Record<string, any>;
}

@Injectable()
export class ProductService {
  private readonly logger = new Logger(ProductService.name);
  private readonly baseUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl = this.configService.productServiceUrl;
  }

  async getProduct(productId: string): Promise<ProductInfo | null> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/api/v1/products/${productId}`)
      );
      
      return this.transformProductResponse(response.data.data);
    } catch (error) {
      this.logger.error(`Failed to fetch product ${productId}:`, error.message);
      if (error.response?.status === 404) {
        return null;
      }
      throw new HttpException('Product service unavailable', HttpStatus.SERVICE_UNAVAILABLE);
    }
  }

  async getProducts(productIds: string[]): Promise<ProductInfo[]> {
    if (productIds.length === 0) return [];

    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.baseUrl}/api/v1/products/batch`, {
          productIds,
        })
      );
      
      return response.data.data.map(product => this.transformProductResponse(product));
    } catch (error) {
      this.logger.error(`Failed to fetch products ${productIds}:`, error.message);
      throw new HttpException('Product service unavailable', HttpStatus.SERVICE_UNAVAILABLE);
    }
  }

  async checkStock(productId: string, variantId?: string, quantity: number = 1): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.baseUrl}/api/v1/products/${productId}/check-stock`, {
          variantId,
          quantity,
        })
      );
      
      return response.data.data.available;
    } catch (error) {
      this.logger.error(`Failed to check stock for product ${productId}:`, error.message);
      return false;
    }
  }

  async getVariant(productId: string, variantId: string): Promise<ProductVariant | null> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/api/v1/products/${productId}/variants/${variantId}`)
      );
      
      return this.transformVariantResponse(response.data.data);
    } catch (error) {
      this.logger.error(`Failed to fetch variant ${variantId} for product ${productId}:`, error.message);
      if (error.response?.status === 404) {
        return null;
      }
      throw new HttpException('Product service unavailable', HttpStatus.SERVICE_UNAVAILABLE);
    }
  }

  async reserveStock(items: Array<{ productId: string; variantId?: string; quantity: number }>): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.baseUrl}/api/v1/products/reserve-stock`, {
          items,
        })
      );
      
      return response.data.success;
    } catch (error) {
      this.logger.error(`Failed to reserve stock:`, error.message);
      return false;
    }
  }

  async releaseStock(items: Array<{ productId: string; variantId?: string; quantity: number }>): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.baseUrl}/api/v1/products/release-stock`, {
          items,
        })
      );
      
      return response.data.success;
    } catch (error) {
      this.logger.error(`Failed to release stock:`, error.message);
      return false;
    }
  }

  private transformProductResponse(productData: any): ProductInfo {
    return {
      id: productData._id || productData.id,
      name: productData.name,
      sku: productData.sku,
      price: productData.price,
      images: productData.images || [],
      category: productData.category,
      brand: productData.brand,
      inStock: productData.inStock && productData.stock > 0,
      availableQuantity: productData.stock,
      variants: productData.variants?.map(v => this.transformVariantResponse(v)) || [],
    };
  }

  private transformVariantResponse(variantData: any): ProductVariant {
    return {
      id: variantData._id || variantData.id,
      name: variantData.name,
      sku: variantData.sku,
      price: variantData.price,
      inStock: variantData.inStock && variantData.stock > 0,
      availableQuantity: variantData.stock,
      attributes: variantData.attributes || {},
    };
  }
}