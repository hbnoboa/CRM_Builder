import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { createHash } from 'crypto';
import { clientIp } from '../utils/client-ip';

/**
 * Throttle das rotas de autenticacao. A chave nao e so o IP: uma empresa inteira
 * costuma sair pelo mesmo IP (wi-fi/NAT) e bater o login de manha ao mesmo tempo.
 *   - login / esqueci a senha: IP + email  -> limita tentativas contra UMA conta
 *   - refresh: hash do refresh token        -> limita por sessao
 *   - rotas autenticadas: a pessoa logada
 *   - cadastro e demais (reset): IP
 * Usar so nas rotas com @Throttle proprio (nao como guard global).
 */
@Injectable()
export class AuthThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const ip = clientIp(req as never);
    const body = (req.body ?? {}) as Record<string, unknown>;

    // Cadastro cria empresa nova: limite por IP, nao por email.
    // Rota autenticada (privacidade, suporte): limite por pessoa, nao pelo IP da empresa.
    const userId = (req.user as { id?: string } | undefined)?.id;
    if (userId) return `user:${userId}`;

    const path = String(req.url ?? '').split('?')[0];
    if (path.endsWith('/register')) return ip;

    // So na rota de refresh: em outra rota, um refreshToken aleatorio no corpo
    // trocaria a chave a cada tentativa e anularia o limite.
    if (path.endsWith('/refresh') && typeof body.refreshToken === 'string' && body.refreshToken) {
      return `refresh:${createHash('sha256').update(body.refreshToken).digest('hex').slice(0, 32)}`;
    }
    if (typeof body.email === 'string' && body.email) {
      return `${ip}:${body.email.trim().toLowerCase()}`;
    }
    // Login por link publico: identifica por e-mail, CPF ou telefone.
    if (typeof body.identifier === 'string' && body.identifier) {
      return `${ip}:${body.identifier.trim().toLowerCase()}`;
    }
    return ip;
  }
}
