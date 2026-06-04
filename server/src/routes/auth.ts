import { Router } from 'express';
import { z } from 'zod';
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from '@simplewebauthn/types';
import { pool } from '../db/client.js';
import { validate } from '../middleware/validate.js';
import { authRateLimit } from '../middleware/security.js';
import { requireAuth } from '../middleware/requireAuth.js';
import {
  beginRegistration,
  finishRegistration,
  beginAuthentication,
  finishAuthentication,
} from '../services/webauthn.js';
import { issueToken } from '../services/jwtService.js';
import { denylist } from '../services/denylist.js';
import { logger } from '../logger.js';
import {
  AuthError,
  NotFoundError,
  ConflictError,
} from '../errors.js';

export const authRouter = Router();

// ── Registration ─────────────────────────────────────────────────────────────

const beginRegSchema = z
  .object({ displayName: z.string().min(1).max(64) })
  .strict();

authRouter.post(
  '/register/begin',
  authRateLimit,
  validate(beginRegSchema),
  async (req, res, next) => {
    try {
      const { displayName } = req.body as { displayName: string };

      // Insert player row — display_name is PII, never logged
      const { rows } = await pool.query<{ id: string }>(
        'INSERT INTO player (display_name) VALUES ($1) RETURNING id',
        [displayName],
      );
      const playerId = rows[0].id;

      const options = await beginRegistration(playerId, displayName);
      res.json({ playerId, options });
    } catch (err) {
      next(err);
    }
  },
);

const finishRegSchema = z.object({}).passthrough(); // WebAuthn response is opaque

authRouter.post(
  '/register/finish',
  authRateLimit,
  validate(finishRegSchema),
  async (req, res, next) => {
    try {
      const { playerId, response } = req.body as {
        playerId: string;
        response: RegistrationResponseJSON;
      };

      const verification = await finishRegistration(
        playerId,
        response,
      );

      if (!verification.verified || !verification.registrationInfo) {
        logger.warn('Registration verification failed', {
          endpoint: '/auth/register/finish',
          httpStatus: 400,
          errorCode: 'WEBAUTHN_VERIFY_FAILED',
        });
        throw new AuthError('Registration failed');
      }

      const { credential } = verification.registrationInfo;
      await pool.query(
        `INSERT INTO player_credential (player_id, credential_id, public_key, sign_count)
         VALUES ($1, $2, $3, $4)`,
        [
          playerId,
          credential.id,
          Buffer.from(credential.publicKey),
          credential.counter,
        ],
      );

      res.json({ message: 'registered' });
    } catch (err) {
      next(err);
    }
  },
);

// ── Authentication ────────────────────────────────────────────────────────────

const beginAuthSchema = z.object({ playerId: z.string().uuid() }).strict();

authRouter.post(
  '/authenticate/begin',
  authRateLimit,
  validate(beginAuthSchema),
  async (req, res, next) => {
    try {
      const { playerId } = req.body as { playerId: string };

      const { rows } = await pool.query<{ credential_id: string }>(
        'SELECT credential_id FROM player_credential WHERE player_id = $1',
        [playerId],
      );

      // Account enumeration prevention (RISK-001): return identical-looking
      // challenge regardless of whether the player exists
      const credentialIds = rows.map((r) => r.credential_id);
      const options = await beginAuthentication(playerId, credentialIds);
      res.json(options);
    } catch (err) {
      next(err);
    }
  },
);

const finishAuthSchema = z.object({}).passthrough();

authRouter.post(
  '/authenticate/finish',
  authRateLimit,
  validate(finishAuthSchema),
  async (req, res, next) => {
    try {
      const { playerId, response } = req.body as {
        playerId: string;
        response: AuthenticationResponseJSON;
      };

      const credRow = await pool.query<{
        id: string;
        credential_id: string;
        public_key: Buffer;
        sign_count: number;
      }>(
        `SELECT id, credential_id, public_key, sign_count
         FROM player_credential WHERE player_id = $1 AND credential_id = $2`,
        [playerId, response.id],
      );

      if (!credRow.rows.length) {
        logger.warn('Auth failure — credential not found', {
          endpoint: '/auth/authenticate/finish',
          httpStatus: 401,
          errorCode: 'AUTH_FAILURE',
        });
        throw new AuthError();
      }

      const cred = credRow.rows[0];
      const verification = await finishAuthentication(
        playerId,
        response,
        cred.credential_id,
        new Uint8Array(cred.public_key),
        cred.sign_count,
      );

      if (!verification.verified) {
        logger.warn('Auth failure — verification failed', {
          endpoint: '/auth/authenticate/finish',
          httpStatus: 401,
          errorCode: 'AUTH_FAILURE',
        });
        throw new AuthError();
      }

      // Update sign_count (clone-detection guard)
      await pool.query(
        'UPDATE player_credential SET sign_count = $1 WHERE id = $2',
        [verification.authenticationInfo.newCounter, cred.id],
      );

      const issued = await issueToken(playerId);
      res.json({ token: issued.token, expiresAt: issued.expiresAt });
    } catch (err) {
      next(err);
    }
  },
);

// ── Logout ────────────────────────────────────────────────────────────────────

authRouter.post('/logout', requireAuth, async (req, res, next) => {
  try {
    const { playerId, jti, exp } = (req as typeof req & {
      auth: { playerId: string; jti: string; exp: number };
    }).auth;

    await denylist.add(jti, new Date(exp * 1000));
    logger.info('Player logged out', {
      playerId,
      endpoint: '/auth/logout',
      httpStatus: 204,
    });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
