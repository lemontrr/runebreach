import { pool } from '../db/client.js';

// PostgreSQL-backed denylist — persists across service restarts (RISK-010)
// Migration 006 creates the denylisted_token table (added in Wave 3)
export const denylist = {
  async isListed(jti: string): Promise<boolean> {
    // Fail closed: if DB is unreachable, throw — caller must treat as denied
    const { rows } = await pool.query<{ jti: string }>(
      `SELECT jti FROM denylisted_token
       WHERE jti = $1 AND expires_at > NOW()`,
      [jti],
    );
    return rows.length > 0;
  },

  async add(jti: string, expiresAt: Date): Promise<void> {
    await pool.query(
      `INSERT INTO denylisted_token (jti, expires_at)
       VALUES ($1, $2)
       ON CONFLICT (jti) DO NOTHING`,
      [jti, expiresAt],
    );
  },

  async addAllForPlayer(playerId: string): Promise<void> {
    // Called on player deletion — we don't track token JTIs per player here,
    // so we rely on the DB cascade delete removing the player row which
    // makes token sub verification fail. If JTI tracking per player is needed,
    // store JTIs in a player_tokens table (future enhancement).
    // For now, the player row deletion + ownership checks provide the guard.
    void playerId;
  },
};
