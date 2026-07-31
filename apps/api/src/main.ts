import { config as loadEnv } from 'dotenv';
import { resolve } from 'path';

// Load monorepo root .env before anything else
loadEnv({ path: resolve(__dirname, '../../../.env') });
loadEnv();

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { RequestIdInterceptor } from './common/interceptors/request-id.interceptor';
import { createLogger } from '@maher/logging';

async function bootstrap() {
  const logger = createLogger('api');
  const app = await NestFactory.create(AppModule, { rawBody: false });

  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cookieParser());
  app.enableCors({
    origin: (process.env.CORS_ORIGINS ?? 'http://localhost:3000').split(','),
    credentials: true,
  });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new RequestIdInterceptor());

  const swagger = new DocumentBuilder()
    .setTitle('Maher Al-Aghbar Furniture ERP API')
    .setDescription('Production ERP API for furniture manufacturing')
    .setVersion('0.1.0')
    .addBearerAuth()
    .addCookieAuth('access_token')
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swagger));

  const port = Number(process.env.API_PORT ?? 4000);
  await app.listen(port);
  logger.info(`API listening on :${port}`);
  logger.info(`Swagger at http://localhost:${port}/api/docs`);
}

bootstrap();
