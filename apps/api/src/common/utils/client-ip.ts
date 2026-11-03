import type { Request } from 'express';

/**
 * IP do cliente atras do nginx. A API nao liga `trust proxy`, entao `req.ip` e o
 * IP do proprio nginx (igual para todo mundo); o nginx manda o real em X-Real-IP.
 */
export function clientIp(req: Pick<Request, 'headers' | 'ip'>): string {
  const real = req.headers['x-real-ip'];
  if (typeof real === 'string' && real) return real.trim();
  const fwd = req.headers['x-forwarded-for'];
  const first = Array.isArray(fwd) ? fwd[0] : fwd?.split(',')[0];
  return first?.trim() || req.ip || 'unknown';
}
