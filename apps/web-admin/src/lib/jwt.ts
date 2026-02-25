/**
 * Decode a JWT token payload without verification.
 * Used client-side to read claims like `exp`.
 * No cryptographic verification — that is the server's job.
 */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );

    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

/**
 * Check if a JWT token is expired based on the `exp` claim.
 * Returns true if expired or if the token cannot be decoded.
 * Adds a buffer (default 30s) to account for clock skew.
 */
export function isTokenExpired(token: string, bufferSeconds = 30): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.exp !== 'number') return true;

  const nowInSeconds = Math.floor(Date.now() / 1000);
  return payload.exp - bufferSeconds <= nowInSeconds;
}
