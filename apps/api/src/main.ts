import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import * as fs from 'fs';
import * as path from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

function validateSecrets(logger: Logger) {
  const jwtSecret = process.env.JWT_SECRET;
  const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET;

  if (!jwtSecret || jwtSecret.length < 32) {
    logger.error('JWT_SECRET is missing or too short (minimum 32 characters). Set a strong secret in .env');
    process.exit(1);
  }
  if (!jwtRefreshSecret || jwtRefreshSecret.length < 32) {
    logger.error('JWT_REFRESH_SECRET is missing or too short (minimum 32 characters). Set a strong secret in .env');
    process.exit(1);
  }
}

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // Validate critical security configuration before starting
  validateSecrets(logger);

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Security headers (Helmet)
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "http:", "https:", "blob:"],
        connectSrc: ["'self'", "http:", "https:", "ws:", "wss:"],
      },
    },
    crossOriginEmbedderPolicy: false, // Permite embed de recursos externos
  }));

  // Serve uploaded files statically
  const uploadsDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  app.useStaticAssets(uploadsDir, { prefix: '/uploads/' });

  // Prefixo global
  app.setGlobalPrefix('api/v1');

  // CORS
  const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:3000';
  app.enableCors({
    origin: corsOrigin === '*' ? true : corsOrigin.split(','),
    credentials: true,
  });
  
  // Exception filter global (previne exposicao de stack traces)
  app.useGlobalFilters(new AllExceptionsFilter());

  // Validação global
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );
  
  // Swagger - apenas em desenvolvimento (nao expor em producao)
  if (process.env.NODE_ENV !== 'production') {
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
    logger.log(`📚 Swagger disponível em http://localhost:${process.env.API_PORT || 3001}/docs`);
  }

  const port = process.env.API_PORT || 3001;
  await app.listen(port);

  logger.log(`🚀 CRM Builder API rodando em http://localhost:${port}`);
}

bootstrap();
