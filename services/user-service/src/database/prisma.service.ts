import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
    console.log('Database connected successfully');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    console.log('Database disconnected');
  }

  async cleanDatabase() {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Cannot clean database in production');
    }

    const modelNames = Reflect.ownKeys(this)
      .filter((key): key is string => typeof key === 'string' && key[0] !== '_')
      .filter(key => {
        const value = this[key as keyof this];
        return value && typeof value === 'object' && 'deleteMany' in value;
      });

    return Promise.all(
      modelNames.map(modelName => {
        const model = this[modelName as keyof this] as any;
        return model.deleteMany();
      })
    );
  }
}