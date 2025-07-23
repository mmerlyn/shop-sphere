import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';
import { ConfigService } from '../config/config.service';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private redis: Redis;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const redisConfig = this.configService.redisConfig;
    
    this.redis = new Redis({
      host: redisConfig.host,
      port: redisConfig.port,
      db: redisConfig.db,
      password: redisConfig.password,
      maxRetriesPerRequest: 3,
      connectTimeout: 10000,
      lazyConnect: true,
      family: 4,
    });

    this.redis.on('connect', () => {
      this.logger.log('Connected to Redis');
    });

    this.redis.on('error', (error) => {
      this.logger.error('Redis connection error:', error);
    });
  }

  async onModuleDestroy() {
    await this.redis.quit();
  }

  async setCart(cartId: string, cartData: any, ttl?: number): Promise<void> {
    try {
      const serializedData = JSON.stringify(cartData);
      if (ttl) {
        await this.redis.setex(`cart:${cartId}`, ttl, serializedData);
      } else {
        await this.redis.set(`cart:${cartId}`, serializedData);
      }
    } catch (error) {
      this.logger.error(`Failed to set cart ${cartId}:`, error);
      throw error;
    }
  }

  async getCart(cartId: string): Promise<any | null> {
    try {
      const data = await this.redis.get(`cart:${cartId}`);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      this.logger.error(`Failed to get cart ${cartId}:`, error);
      throw error;
    }
  }

  async deleteCart(cartId: string): Promise<void> {
    try {
      await this.redis.del(`cart:${cartId}`);
    } catch (error) {
      this.logger.error(`Failed to delete cart ${cartId}:`, error);
      throw error;
    }
  }

  async cartExists(cartId: string): Promise<boolean> {
    try {
      const exists = await this.redis.exists(`cart:${cartId}`);
      return exists === 1;
    } catch (error) {
      this.logger.error(`Failed to check cart existence ${cartId}:`, error);
      return false;
    }
  }

  async setSession(sessionId: string, sessionData: any, ttl: number): Promise<void> {
    try {
      const serializedData = JSON.stringify(sessionData);
      await this.redis.setex(`session:${sessionId}`, ttl, serializedData);
    } catch (error) {
      this.logger.error(`Failed to set session ${sessionId}:`, error);
      throw error;
    }
  }

  async getSession(sessionId: string): Promise<any | null> {
    try {
      const data = await this.redis.get(`session:${sessionId}`);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      this.logger.error(`Failed to get session ${sessionId}:`, error);
      throw error;
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    try {
      await this.redis.del(`session:${sessionId}`);
    } catch (error) {
      this.logger.error(`Failed to delete session ${sessionId}:`, error);
      throw error;
    }
  }

  async setUserCart(userId: string, cartId: string): Promise<void> {
    try {
      await this.redis.set(`user:cart:${userId}`, cartId);
    } catch (error) {
      this.logger.error(`Failed to set user cart mapping ${userId}:`, error);
      throw error;
    }
  }

  async getUserCart(userId: string): Promise<string | null> {
    try {
      return await this.redis.get(`user:cart:${userId}`);
    } catch (error) {
      this.logger.error(`Failed to get user cart mapping ${userId}:`, error);
      return null;
    }
  }

  async deleteUserCart(userId: string): Promise<void> {
    try {
      await this.redis.del(`user:cart:${userId}`);
    } catch (error) {
      this.logger.error(`Failed to delete user cart mapping ${userId}:`, error);
      throw error;
    }
  }

  async setExpiry(key: string, ttl: number): Promise<void> {
    try {
      await this.redis.expire(key, ttl);
    } catch (error) {
      this.logger.error(`Failed to set expiry for ${key}:`, error);
      throw error;
    }
  }

  async getTtl(key: string): Promise<number> {
    try {
      return await this.redis.ttl(key);
    } catch (error) {
      this.logger.error(`Failed to get TTL for ${key}:`, error);
      return -1;
    }
  }

  async atomicUpdate(cartId: string, updateFn: (data: any) => any, ttl?: number): Promise<any> {
    const key = `cart:${cartId}`;
    
    try {
      const result = await this.redis.multi()
        .get(key)
        .exec();

      if (!result || !result[0] || result[0][1] === null) {
        throw new Error('Cart not found');
      }

      const currentData = JSON.parse(result[0][1] as string);
      const updatedData = updateFn(currentData);
      
      const serializedData = JSON.stringify(updatedData);
      
      if (ttl) {
        await this.redis.setex(key, ttl, serializedData);
      } else {
        await this.redis.set(key, serializedData);
      }

      return updatedData;
    } catch (error) {
      this.logger.error(`Failed atomic update for cart ${cartId}:`, error);
      throw error;
    }
  }

  async ping(): Promise<string> {
    try {
      return await this.redis.ping();
    } catch (error) {
      this.logger.error('Redis ping failed:', error);
      throw error;
    }
  }

  async getInfo(): Promise<any> {
    try {
      const info = await this.redis.info();
      return info;
    } catch (error) {
      this.logger.error('Failed to get Redis info:', error);
      throw error;
    }
  }
}