import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { createHash } from 'crypto';
import { clientIp } from '../utils/client-ip';

/**
 * Throttle das rotas de autenticacao. A chave nao e so o IP: uma empresa inteira
 * costuma sair pelo mesmo IP (wi-fi/NAT) e bater o login de manha ao mesmo tempo.
 *   - login / esqueci a senha: IP + email  -> limita tentativas contra UMA conta
 *   - refresh: hash do refresh token        -> limita por sessao
 *   - cadastro e demais (reset): IP
 * Usar so nas rotas com @Throttle proprio (nao como guard global).
 */
@Injectable()
export class AuthThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const ip = clientIp(req as never);
    const body = (req.body ?? {}) as Record<string, unknown>;

    // Cadastro cria empresa nova: limite por IP, nao por email.
    if (String(req.url ?? '').split('?')[0].endsWith('/register')) return ip;

    if (typeof body.refreshToken === 'string' && body.refreshToken) {
      return `refresh:${createHash('sha256').update(body.refreshToken).digest('hex').slice(0, 32)}`;
    }
    if (typeof body.email === 'string' && body.email) {
      return `${ip}:${body.email.trim().toLowerCase()}`;
    }
    return ip;
  }
}
