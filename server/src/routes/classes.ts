import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { pool } from '../db/client.js';

export const classesRouter = Router();

classesRouter.get('/', requireAuth, async (_req, res, next) => {
  try {
    const { rows } = await pool.query<{
      id: string;
      name: string;
      base_hp: number;
      base_attack: number;
      base_defense: number;
      base_speed: number;
      ability_id: string | null;
      ability_name: string | null;
      ability_description: string | null;
    }>(
      `SELECT
         pc.id,
         pc.name,
         pc.base_hp,
         pc.base_attack,
         pc.base_defense,
         pc.base_speed,
         ca.id     AS ability_id,
         ca.name   AS ability_name,
         ca.description AS ability_description
       FROM player_class pc
       LEFT JOIN class_ability ca ON ca.player_class_id = pc.id
       ORDER BY pc.name, ca.name`,
    );

    // Group abilities by class
    const classMap = new Map<string, {
      id: string;
      name: string;
      baseHp: number;
      baseAttack: number;
      baseDefense: number;
      baseSpeed: number;
      abilities: { id: string; name: string; description: string }[];
    }>();

    for (const row of rows) {
      if (!classMap.has(row.id)) {
        classMap.set(row.id, {
          id: row.id,
          name: row.name,
          baseHp: row.base_hp,
          baseAttack: row.base_attack,
          baseDefense: row.base_defense,
          baseSpeed: row.base_speed,
          abilities: [],
        });
      }
      if (row.ability_id) {
        classMap.get(row.id)!.abilities.push({
          id: row.ability_id,
          name: row.ability_name!,
          description: row.ability_description!,
        });
      }
    }

    // Static catalog — allow short-lived caching (overrides global no-store)
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.json([...classMap.values()]);
  } catch (err) {
    next(err);
  }
});
