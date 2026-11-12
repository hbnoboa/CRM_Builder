import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

/** AES-256-GCM para segredos guardados no banco (ex.: segredo do TOTP). */
function key(): Buffer {
  const material = process.env.MFA_ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!material) throw new Error('MFA_ENCRYPTION_KEY/JWT_SECRET nao configurado');
  return createHash('sha256').update(`secret-box:${material}`).digest();
}

export function seal(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), data.toString('base64')].join('.');
}

export function open(sealed: string): string {
  const [version, iv, tag, data] = sealed.split('.');
  if (version !== 'v1') throw new Error('formato de segredo desconhecido');
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
}
