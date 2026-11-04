import { createHash } from 'crypto';

/** Hash do refresh token (o banco nunca guarda o token puro). */
export const hashRefreshToken = (token: string) => createHash('sha256').update(token).digest('hex');

export interface ClientInfo {
  ip?: string;
  userAgent?: string;
}

// Sessao valida? O JwtStrategy pergunta a cada requisicao; guarda a resposta por 10s
// para nao ir ao banco toda hora. Encerrar uma sessao limpa o cache na hora.
const TTL_MS = 10_000;
const cache = new Map<string, { valid: boolean; at: number }>();

export function cachedSessionValidity(sessionId: string): boolean | undefined {
  const hit = cache.get(sessionId);
  if (!hit || Date.now() - hit.at > TTL_MS) return undefined;
  return hit.valid;
}

export function rememberSessionValidity(sessionId: string, valid: boolean): void {
  if (cache.size > 50_000) cache.clear();
  cache.set(sessionId, { valid, at: Date.now() });
}

export function forgetSessions(sessionIds: string[]): void {
  for (const id of sessionIds) cache.delete(id);
}
