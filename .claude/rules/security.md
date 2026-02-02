# 🔒 Práticas de Segurança

## Autenticação

### Senhas
```typescript
// Sempre usar bcrypt com cost >= 12
import * as bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

// Hash
const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

// Verify
const isValid = await bcrypt.compare(password, hashedPassword);
```

### JWT
```typescript
// Tokens de curta duração
const accessToken = this.jwtService.sign(
  { sub: user.id, tenantId: user.tenantId },
  { expiresIn: '15m' } // Curta duração
);

// Refresh tokens de longa duração
const refreshToken = this.jwtService.sign(
  { sub: user.id, type: 'refresh' },
  { 
    secret: process.env.JWT_REFRESH_SECRET, // Secret diferente
    expiresIn: '7d' 
  }
);
```

### Secrets
```bash
# Gerar secrets seguros
openssl rand -hex 32

# Nunca usar em código
JWT_SECRET=minha-chave-fraca  # ❌ ERRADO

# Sempre de variáveis de ambiente
JWT_SECRET=${process.env.JWT_SECRET}  # ✅ CORRETO
```

## Validação de Input

### DTOs (Backend)
```typescript
import { IsString, IsEmail, MinLength, MaxLength, Matches } from 'class-validator';

export class CreateUserDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'Senha deve ter maiúscula, minúscula e número',
  })
  password: string;
}
```

### Zod (Frontend)
```typescript
const userSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string()
    .min(8)
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/),
});
```

### Sanitização
```typescript
// Escapar HTML em inputs de texto
import { escape } from 'lodash';

const safeName = escape(userInput);

// Nunca interpolar SQL
// ❌ ERRADO
const query = `SELECT * FROM users WHERE id = '${id}'`;

// ✅ CORRETO (Prisma faz automaticamente)
const user = await prisma.user.findUnique({ where: { id } });
```

## Rate Limiting

```typescript
// app.module.ts
import { ThrottlerModule } from '@nestjs/throttler';

@Module({
  imports: [
    ThrottlerModule.forRoot([{
      ttl: 60000,  // 1 minuto
      limit: 100,  // 100 requests
    }]),
  ],
})

// Aplicar em rotas sensíveis
@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // Mais restrito
  login() {}
}
```

## CORS

```typescript
// main.ts
app.enableCors({
  origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});
```

## Headers de Segurança

```typescript
// Nginx ou middleware
// X-Frame-Options: DENY
// X-Content-Type-Options: nosniff
// X-XSS-Protection: 1; mode=block
// Strict-Transport-Security: max-age=31536000; includeSubDomains
// Content-Security-Policy: default-src 'self'
```

## Upload de Arquivos

```typescript
// Validar tipo de arquivo
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

@Post('upload')
@UseInterceptors(FileInterceptor('file', {
  limits: { fileSize: MAX_SIZE },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_TYPES.includes(file.mimetype)) {
      cb(new BadRequestException('Tipo de arquivo não permitido'), false);
      return;
    }
    cb(null, true);
  },
}))
upload(@UploadedFile() file: Express.Multer.File) {
  // Gerar nome aleatório (nunca usar nome original)
  const filename = `${uuid()}.${file.mimetype.split('/')[1]}`;
  // ...
}
```

## Logs Sensíveis

```typescript
// ❌ NUNCA logar
logger.log({ password, token, creditCard });

// ✅ Logar apenas metadados
logger.log({
  action: 'login',
  userId: user.id,
  ip: request.ip,
  userAgent: request.headers['user-agent'],
});
```

## Erros em Produção

```typescript
// Exception filter
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const isProduction = process.env.NODE_ENV === 'production';
    
    const response = {
      statusCode: status,
      message: isProduction 
        ? 'Erro interno' // Mensagem genérica
        : exception.message, // Detalhes só em dev
      // Nunca expor stack trace em produção
      ...(isProduction ? {} : { stack: exception.stack }),
    };
    
    // Logar erro completo internamente
    this.logger.error(exception);
    
    return response;
  }
}
```

## Checklist de Segurança

- [ ] Senhas com bcrypt (cost 12+)
- [ ] JWT com secrets fortes e rotação
- [ ] Validação em todos os inputs
- [ ] Rate limiting em rotas sensíveis
- [ ] CORS configurado corretamente
- [ ] Headers de segurança
- [ ] Uploads validados
- [ ] Logs não expõem dados sensíveis
- [ ] Erros não expõem stack traces
- [ ] HTTPS em produção
- [ ] Secrets em variáveis de ambiente
