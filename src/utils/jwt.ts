import { SignJWT, jwtVerify } from 'jose';

/**
 * JWT Token payload
 */
export interface JWTPayload {
  playerId: string;
  exp: number;
  iat: number;
}

/**
 * JWT Secret from environment
 */
function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set');
  }
  return secret;
}

/**
 * Generate a JWT token for a player
 * @param playerId - The player's unique identifier
 * @returns A signed JWT token string
 */
export async function generateToken(playerId: string): Promise<string> {
  const secret = getSecret();
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 24 * 60 * 60; // 24 hours from now

  const token = await new SignJWT({ playerId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .sign(new TextEncoder().encode(secret));

  return token;
}

/**
 * Validate and decode a JWT token
 * @param token - The JWT token string
 * @returns Decoded payload if valid, null otherwise
 */
export async function validateToken(token: string): Promise<{ playerId: string } | null> {
  try {
    const secret = getSecret();
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));

    return {
      playerId: (payload.playerId as string) || '',
    };
  } catch (error) {
    // Token is invalid (wrong signature, expired, malformed, etc.)
    return null;
  }
}
