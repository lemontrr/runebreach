import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { pool } from '../db/client.js';
import { denylist } from '../services/denylist.js';
import { logger } from '../logger.js';
import { ForbiddenError, NotFoundError } from '../errors.js';

export const playersRouter = Router();

// GDPR right to erasure — DELETE /players/:id
// Cascades to GameSession, ItemPlacement, MonsterPlacement via FK ON DELETE CASCADE
playersRouter.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const { playerId, jti, exp } = req.auth!;

    // Players can only delete their own account — no cross-player deletion
    if (req.params.id !== playerId) {
      return next(new ForbiddenError());
    }

    // Revoke current token before deleting the row (no window where row is gone but token works)
    await denylist.add(jti, new Date(exp * 1000));
    await denylist.addAllForPlayer(playerId);

    // Transaction: cascade delete is handled by FK constraints (INFRA-03)
    const result = await pool.query(
      'DELETE FROM player WHERE id = $1 RETURNING id',
      [playerId],
    );

    if (!result.rows.length) {
      return next(new NotFoundError());
    }

    // Log deletion event — player_id (opaque UUID) only, never display_name
    logger.info('Player account deleted', {
      playerId,
      endpoint: '/players/:id',
      httpStatus: 204,
    });

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
