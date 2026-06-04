import { Pool } from 'pg';
import { config } from '../config.js';

export const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: config.env === 'production' ? { rejectUnauthorized: true } : false,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  // TODO: statement_timeout enforced at DB role level; add query-level timeout if needed
});

pool.on('error', (err) => {
  // Non-fatal pool error — logged but not crashing; individual queries will fail naturally
  process.stderr.write(`[pg pool error] ${err.message}\n`);
});
