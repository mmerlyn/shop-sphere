import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from '@elastic/elasticsearch';

const PRODUCTS_INDEX = 'products';

interface ProductDocument {
  id: string;
  name: string;
  description: string;
  sku: string;
  slug: string;
  price: number;
  categoryId: string;
  categoryName?: string;
  brand?: string;
  tags: string[];
  isActive: boolean;
  isFeatured: boolean;
  inventory: number;
  createdAt: Date;
}

@Injectable()
export class SearchService implements OnModuleInit {
  private client: Client;
  private readonly logger = new Logger(SearchService.name);
  private isConnected = false;

  constructor(private configService: ConfigService) {
    const node = this.configService.get<string>('ELASTICSEARCH_NODE') || 'http://localhost:9200';
    this.client = new Client({ node });
  }

  async onModuleInit() {
    try {
      await this.client.ping();
      this.isConnected = true;
      this.logger.log('Elasticsearch connected');
      await this.createIndexIfNotExists();
    } catch (error) {
      this.logger.warn('Elasticsearch not available, search features disabled');
      this.isConnected = false;
    }
  }

  private async createIndexIfNotExists() {
    if (!this.isConnected) return;

    try {
      const exists = await this.client.indices.exists({ index: PRODUCTS_INDEX });

      if (!exists) {
        await this.client.indices.create({
          index: PRODUCTS_INDEX,
          body: {
            settings: {
              analysis: {
                analyzer: {
                  product_analyzer: {
                    type: 'custom',
                    tokenizer: 'standard',
                    filter: ['lowercase', 'asciifolding'],
                  },
                },
              },
            },
            mappings: {
              properties: {
                id: { type: 'keyword' },
                name: { type: 'text', analyzer: 'product_analyzer' },
                description: { type: 'text', analyzer: 'product_analyzer' },
                sku: { type: 'keyword' },
                slug: { type: 'keyword' },
                price: { type: 'float' },
                categoryId: { type: 'keyword' },
                categoryName: { type: 'text' },
                brand: { type: 'keyword' },
                tags: { type: 'keyword' },
                isActive: { type: 'boolean' },
                isFeatured: { type: 'boolean' },
                inventory: { type: 'integer' },
                createdAt: { type: 'date' },
              },
            },
          },
        });
        this.logger.log('Products index created');
      }
    } catch (error) {
      this.logger.error('Failed to create index', error);
    }
  }

  async indexProduct(product: ProductDocument) {
    if (!this.isConnected) return;

    try {
      await this.client.index({
        index: PRODUCTS_INDEX,
        id: product.id,
        body: product,
        refresh: true,
      });
    } catch (error) {
      this.logger.error(`Failed to index product ${product.id}`, error);
    }
  }

  async updateProduct(id: string, product: Partial<ProductDocument>) {
    if (!this.isConnected) return;

    try {
      await this.client.update({
        index: PRODUCTS_INDEX,
        id,
        body: { doc: product },
        refresh: true,
      });
    } catch (error) {
      this.logger.error(`Failed to update product ${id}`, error);
    }
  }

  async deleteProduct(id: string) {
    if (!this.isConnected) return;

    try {
      await this.client.delete({
        index: PRODUCTS_INDEX,
        id,
        refresh: true,
      });
    } catch (error) {
      this.logger.error(`Failed to delete product ${id}`, error);
    }
  }

  async search(params: {
    q?: string;
    category?: string;
    brand?: string;
    minPrice?: number;
    maxPrice?: number;
    tags?: string[];
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<{ hits: any[]; total: number }> {
    if (!this.isConnected) {
      return { hits: [], total: 0 };
    }

    const {
      q,
      category,
      brand,
      minPrice,
      maxPrice,
      tags,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = params;

    const must: any[] = [{ term: { isActive: true } }];
    const filter: any[] = [];

    if (q) {
      must.push({
        multi_match: {
          query: q,
          fields: ['name^3', 'description', 'brand', 'tags'],
          fuzziness: 'AUTO',
        },
      });
    }

    if (category) {
      filter.push({ term: { categoryId: category } });
    }

    if (brand) {
      filter.push({ term: { brand } });
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      const range: any = {};
      if (minPrice !== undefined) range.gte = minPrice;
      if (maxPrice !== undefined) range.lte = maxPrice;
      filter.push({ range: { price: range } });
    }

    if (tags && tags.length > 0) {
      filter.push({ terms: { tags } });
    }

    try {
      const result = await this.client.search({
        index: PRODUCTS_INDEX,
        body: {
          from: (page - 1) * limit,
          size: limit,
          query: {
            bool: {
              must,
              filter,
            },
          },
          sort: [{ [sortBy]: { order: sortOrder } }],
        },
      });

      const hits = result.hits.hits.map((hit: any) => ({
        ...hit._source,
        _score: hit._score,
      }));

      const total = typeof result.hits.total === 'number'
        ? result.hits.total
        : result.hits.total?.value || 0;

      return { hits, total };
    } catch (error) {
      this.logger.error('Search failed', error);
      return { hits: [], total: 0 };
    }
  }

  isAvailable(): boolean {
    return this.isConnected;
  }
}
