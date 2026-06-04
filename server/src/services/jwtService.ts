import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { config } from '../config.js';

const ALG = 'HS256';
const ISSUER = 'runebreach-api';
const AUDIENCE = 'runebreach-api';
// TTL in seconds — 15 minutes
const TOKEN_TTL_S = 15 * 60;

function getKey(): Uint8Array {
  return new TextEncoder().encode(config.jwtSecret);
}

export interface TokenPayload extends JWTPayload {
  sub: string;   // player UUID
  jti: string;   // used for denylist
}

export interface IssuedToken {
  token: string;
  expiresAt: Date;
}

export async function issueToken(playerId: string): Promise<IssuedToken> {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + TOKEN_TTL_S;
  const jti = crypto.randomUUID();

  const token = await new SignJWT({ sub: playerId, jti })
    .setProtectedHeader({ alg: ALG })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt(now)
    .setNotBefore(now)
    .setExpirationTime(exp)
    .sign(getKey());

  return { token, expiresAt: new Date(exp * 1000) };
}

export async function verifyToken(token: string): Promise<TokenPayload> {
  const { payload } = await jwtVerify(token, getKey(), {
    algorithms: [ALG],   // explicit alg assertion — never allow alg:none
    issuer: ISSUER,
    audience: AUDIENCE,
  });

  if (!payload.sub || !payload.jti) {
    throw new Error('Missing required claims');
  }

  return payload as TokenPayload;
}
