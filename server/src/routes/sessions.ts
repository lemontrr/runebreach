import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/requireAuth.js';
import { validate } from '../middleware/validate.js';
import { pool } from '../db/client.js';
import { config } from '../config.js';
import { generateMaze, serializeMaze } from '../services/mazeGenerator.js';
import { placeItems } from '../services/itemPlacer.js';
import { placeMonsters } from '../services/monsterPlacer.js';
import { logger } from '../logger.js';
import { ConflictError, NotFoundError, ForbiddenError } from '../errors.js';
import type { ItemType } from '../services/itemPlacer.js';
import type { MonsterType } from '../services/monsterPlacer.js';

export const sessionsRouter = Router();

// ── POST /sessions — Initialize a new game session ────────────────────────

const createSessionSchema = z.object({ classId: z.string().uuid() }).strict();

sessionsRouter.post('/', requireAuth, validate(createSessionSchema), async (req, res, next) => {
  try {
    const { playerId } = req.auth!;
    const { classId } = req.body as { classId: string };

    // Verify classId exists in catalog
    const classRow = await pool.query<{ id: string }>(
      'SELECT id FROM player_class WHERE id = $1',
      [classId],
    );
    if (!classRow.rows.length) {
      return next(new NotFoundError('Class not found'));
    }

    // Load catalogs
    const [itemTypesResult, monsterTypesResult] = await Promise.all([
      pool.query<ItemType>('SELECT id, name, category, stat_effect FROM item_type'),
      pool.query<MonsterType>('SELECT id, name, hp, attack, defense, speed, behavior_flags FROM monster_type'),
    ]);

    // Generate maze — seed is server-generated crypto-random, never from client (SECURITY.md)
    const mazeSeed = crypto.randomUUID();
    const mazeGrid = generateMaze(mazeSeed, config.maze.width, config.maze.height);
    const mazeLayout = serializeMaze(mazeGrid);

    // Place items and monsters
    const itemPlacements = placeItems(
      mazeGrid,
      mazeSeed,
      itemTypesResult.rows,
      config.itemCount,
    );
    const itemPositionSet = new Set(itemPlacements.map((p) => p.position));
    const monsterPlacements = placeMonsters(
      mazeGrid,
      mazeSeed,
      itemPositionSet,
      monsterTypesResult.rows,
      config.monsterCount,
    );

    // Atomic transaction — maze_seed stored but NEVER returned to client
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const sessionResult = await client.query<{ id: string }>(
        `INSERT INTO game_session (player_id, player_class_id, maze_seed, maze_layout)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [playerId, classId, mazeSeed, mazeLayout],
      );
      const sessionId = sessionResult.rows[0].id;

      if (itemPlacements.length > 0) {
        const itemValues = itemPlacements.map((p) => `('${sessionId}', '${p.itemTypeId}', '${p.position}')`).join(',');
        await client.query(
          `INSERT INTO item_placement (game_session_id, item_type_id, position) VALUES ${itemValues}`,
        );
      }

      if (monsterPlacements.length > 0) {
        const monsterValues = monsterPlacements.map((p) => `('${sessionId}', '${p.monsterTypeId}', '${p.position}')`).join(',');
        await client.query(
          `INSERT INTO monster_placement (game_session_id, monster_type_id, position) VALUES ${monsterValues}`,
        );
      }

      await client.query('COMMIT');

      logger.info('Game session created', {
        playerId,
        endpoint: '/sessions',
        httpStatus: 201,
      });

      // maze_seed is NOT included in the response (SECURITY.md)
      res.status(201).json({
        sessionId,
        mazeLayout,
        playerClassId: classId,
        itemPlacements: itemPlacements.map((p) => ({
          itemTypeId: p.itemTypeId,
          position: p.position,
          collected: false,
        })),
        monsterPlacements: monsterPlacements.map((p) => ({
          monsterTypeId: p.monsterTypeId,
          position: p.position,
          defeated: false,
        })),
      });
    } catch (err) {
      await client.query('ROLLBACK');
      // DB unique constraint on (player_id, state=active) maps to 409 (RISK-003)
      const pgErr = err as { code?: string };
      if (pgErr.code === '23505') {
        return next(new ConflictError('Active session already exists'));
      }
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    next(err);
  }
});

// ── GET /sessions/:id — Retrieve current game state ───────────────────────

sessionsRouter.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const { playerId } = req.auth!;
    const sessionId = req.params.id;

    const sessionResult = await pool.query<{
      id: string;
      player_id: string;
      player_class_id: string;
      maze_layout: string;
      state: string;
    }>(
      // maze_seed is explicitly excluded from SELECT
      `SELECT id, player_id, player_class_id, maze_layout, state
       FROM game_session WHERE id = $1`,
      [sessionId],
    );

    if (!sessionResult.rows.length) {
      return next(new NotFoundError());
    }

    const session = sessionResult.rows[0];

    // Cross-player access prevention (SECURITY.md — STRIDE T-13)
    if (session.player_id !== playerId) {
      return next(new ForbiddenError());
    }

    const [classResult, itemsResult, monstersResult] = await Promise.all([
      pool.query(
        'SELECT id, name, base_hp, base_attack, base_defense, base_speed FROM player_class WHERE id = $1',
        [session.player_class_id],
      ),
      pool.query(
        `SELECT ip.id, ip.position, ip.collected,
                it.id AS item_type_id, it.name, it.category, it.stat_effect
         FROM item_placement ip
         JOIN item_type it ON it.id = ip.item_type_id
         WHERE ip.game_session_id = $1`,
        [sessionId],
      ),
      pool.query(
        `SELECT mp.id, mp.position, mp.defeated,
                mt.id AS monster_type_id, mt.name, mt.hp, mt.attack, mt.defense, mt.speed
         FROM monster_placement mp
         JOIN monster_type mt ON mt.id = mp.monster_type_id
         WHERE mp.game_session_id = $1`,
        [sessionId],
      ),
    ]);

    res.json({
      sessionId: session.id,
      state: session.state,
      mazeLayout: session.maze_layout,
      playerClass: classResult.rows[0] ?? null,
      itemPlacements: itemsResult.rows,
      monsterPlacements: monstersResult.rows,
    });
  } catch (err) {
    next(err);
  }
});
