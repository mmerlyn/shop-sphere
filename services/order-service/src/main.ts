import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn', 'debug', 'verbose'],
  });

  const configService = app.get(ConfigService);

  await app.enableShutdownHooks();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      validateCustomDecorators: true,
    }),
  );

  app.enableCors({
    origin: configService.get<string>('CORS_ORIGIN', '*'),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  });

  app.setGlobalPrefix('api/v1', {
    exclude: ['health', 'health/ready', 'health/live'],
  });

  if (configService.get<string>('NODE_ENV') !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('ShopSphere Order Service')
      .setDescription('Order management microservice for ShopSphere e-commerce platform')
      .setVersion('1.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          name: 'JWT',
          description: 'Enter JWT token',
          in: 'header',
        },
        'JWT-auth',
      )
      .addTag('Orders', 'Order management operations')
      .addTag('Health', 'Health check endpoints')
      .addServer('http://localhost:3004', 'Development server')
      .addServer('https://api.shopsphere.com', 'Production server')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        tagsSorter: 'alpha',
        operationsSorter: 'alpha',
      },
    });

    logger.log('Swagger documentation available at /api/docs');
  }

  const port = configService.get<number>('PORT', 3004);
  await app.listen(port);

  logger.log(`Order Service is running on port ${port}`);
  logger.log(`Environment: ${configService.get<string>('NODE_ENV', 'development')}`);
  logger.log(`Health check available at /health`);
  logger.log(`API Documentation available at /api/docs`);
}

bootstrap().catch((error) => {
  Logger.error('Failed to start Order Service:', error);
  process.exit(1);
});
