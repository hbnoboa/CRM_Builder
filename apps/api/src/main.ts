import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);
  
  // Prefixo global
  app.setGlobalPrefix('api/v1');
  
  // CORS
  app.enableCors({
    origin: process.env.API_CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
    credentials: true,
  });
  
  // Validação global
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
  
  // Swagger
  const config = new DocumentBuilder()
    .setTitle('CRM Builder API')
    .setDescription('API do CRM Builder - Plataforma SaaS Multi-Tenant')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('Auth', 'Autenticação e tokens')
    .addTag('Users', 'Gerenciamento de usuários')
    .addTag('Tenants', 'Gerenciamento de tenants')
    .addTag('Roles', 'Permissões e papéis')
    .addTag('Entities', 'Definição de entidades')
    .addTag('Data', 'CRUD dinâmico de dados')
    .build();
  
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);
  
  const port = process.env.API_PORT || 3001;
  await app.listen(port);
  
  logger.log(`🚀 CRM Builder API rodando em http://localhost:${port}`);
  logger.log(`📚 Swagger disponível em http://localhost:${port}/docs`);
}

bootstrap();
