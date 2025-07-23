import { ConfigService } from './config.service';

export interface RedisConnectionOptions {
  host: string;
  port: number;
  db: number;
  password?: string;
  retryDelayOnFailover: number;
  maxRetriesPerRequest: number;
  connectTimeout: number;
  commandTimeout: number;
  family: number;
}

export const createRedisConfig = (configService: ConfigService): RedisConnectionOptions => {
  const redisConfig = configService.redisConfig;
  
  return {
    host: redisConfig.host,
    port: redisConfig.port,
    db: redisConfig.db,
    password: redisConfig.password,
    retryDelayOnFailover: 100,
    maxRetriesPerRequest: 3,
    connectTimeout: 10000,
    commandTimeout: 5000,
    family: 4,
  };
};