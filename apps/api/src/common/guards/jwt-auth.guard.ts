import { ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { API_KEY_PREFIX, ApiKeyService } from '../../modules/api-key/api-key.service';

// Chave de API so le/grava registros (e envia arquivos deles); nunca administra a
// empresa (usuarios, cargos, chaves, configuracoes).
const API_KEY_ROUTES: Array<{ prefix: string; methods?: string[] }> = [
  { prefix: '/api/v1/data/' },
  { prefix: '/api/v1/entities', methods: ['GET'] },
  { prefix: '/api/v1/upload/', methods: ['POST'] },
];

function apiKeyFrom(req: Request): string | null {
  const header = req.headers['x-api-key'];
  if (typeof header === 'string' && header.startsWith(API_KEY_PREFIX)) return header;
  const auth = req.headers.authorization;
  if (auth?.startsWith(`Bearer ${API_KEY_PREFIX}`)) return auth.slice('Bearer '.length);
  return null;
}

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly apiKeys: ApiKeyService) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request & { user?: unknown }>();
    const key = apiKeyFrom(req);
    if (!key) return super.canActivate(context) as Promise<boolean>;

    const path = req.originalUrl.split('?')[0];
    const allowed = API_KEY_ROUTES.some(
      (r) => (path === r.prefix.replace(/\/$/, '') || path.startsWith(r.prefix)) && (!r.methods || r.methods.includes(req.method)),
    );
    if (!allowed) throw new ForbiddenException('Chave de API so acessa registros, tabelas e upload');
    req.user = await this.apiKeys.authenticate(key);
    return true;
  }
}
