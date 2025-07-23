import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { ConfigService } from './config/config.service';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  
  const app = await NestFactory.create(AppModule);
  
  const configService = app.get(ConfigService);
  
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  app.setGlobalPrefix(configService.apiPrefix);

  app.enableCors({
    origin: process.env.NODE_ENV === 'production' 
      ? ['https://yourdomain.com'] 
      : true,
    credentials: true,
  });

  const port = configService.port;
  await app.listen(port);
  
  logger.log(`🛒 Cart Service running on port ${port}`);
  logger.log(`📊 Health check available at http://localhost:${port}/${configService.apiPrefix}/health`);
}

bootstrap().catch((error) => {
  console.error('Failed to start Cart Service:', error);
  process.exit(1);
});