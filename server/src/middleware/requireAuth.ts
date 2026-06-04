import { Request, Response, NextFunction } from 'express';
import { jwtVerify } from 'jose';
import { config } from '../config.js';
import { denylist } from '../services/denylist.js';
import { logger } from '../logger.js';
import { AuthError } from '../errors.js';

const ALG = 'HS256';
const ISSUER = 'runebreach-api';
const AUDIENCE = 'runebreach-api';

export interface AuthContext {
  playerId: string;
  jti: string;
  exp: number;
}

export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next(new AuthError());
  }

  const token = header.slice(7);

  try {
    const key = new TextEncoder().encode(config.jwtSecret);
    const { payload } = await jwtVerify(token, key, {
      algorithms: [ALG],   // explicit alg assertion — reject alg:none (SECURITY.md)
      issuer: ISSUER,
      audience: AUDIENCE,
    });

    const { sub, jti, exp } = payload;
    if (!sub || !jti || !exp) {
      throw new Error('Missing required claims');
    }

    // Denylist check — fail closed if DB unreachable
    const denied = await denylist.isListed(jti as string);
    if (denied) {
      logger.warn('Token on denylist', {
        endpoint: req.path,
        httpStatus: 401,
        errorCode: 'TOKEN_DENIED',
      });
      return next(new AuthError());
    }

    req.auth = { playerId: sub, jti: jti as string, exp: exp as number };
    next();
  } catch (err) {
    logger.warn('Token validation failure', {
      endpoint: req.path,
      httpStatus: 401,
      errorCode: 'TOKEN_INVALID',
    });
    next(new AuthError());
  }
}
