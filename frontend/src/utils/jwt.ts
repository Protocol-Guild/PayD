export interface JwtPayload {
  // standard claims
  exp?: number;
  iat?: number;

  // custom fields
  role?: string;
  organizationId?: string;
  walletAddress?: string;
  [key: string]: any;
}

/**
 * Decodes a JWT without validation; returns null on failure.
 */
export function decodeJwt<T extends JwtPayload = JwtPayload>(token: string): T | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    // base64url -> base64
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(base64);
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}
