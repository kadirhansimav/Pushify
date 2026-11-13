import 'server-only';

export type Queryable = {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
};

type Db = Queryable & {
  transaction<T>(fn: (q: Queryable) => Promise<T>): Promise<T>;
};

const SCHEMA = `
CREATE TABLE IF NOT EXISTS rooms (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  win_rule TEXT NOT NULL CHECK (win_rule IN ('all', 'any')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'finished')),
  winner_id TEXT,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS goals (
  id SERIAL PRIMARY KEY,
  room_code TEXT NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
  title TEXT NOT NULL,
  unit TEXT NOT NULL,
  target DOUBLE PRECISION NOT NULL CHECK (target > 0),
  sort INT NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS participants (
  id TEXT PRIMARY KEY,
  room_code TEXT NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
  name TEXT NOT NULL,
  stake TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  is_creator BOOLEAN NOT NULL DEFAULT false,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (room_code, name)
);
CREATE TABLE IF NOT EXISTS logs (
  id SERIAL PRIMARY KEY,
  participant_id TEXT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  goal_id INT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  amount DOUBLE PRECISION NOT NULL CHECK (amount > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS logs_participant_idx ON logs(participant_id);
CREATE INDEX IF NOT EXISTS goals_room_idx ON goals(room_code);
CREATE INDEX IF NOT EXISTS participants_room_idx ON participants(room_code);
`;

async function createPgDb(url: string): Promise<Db> {
  const { Pool } = await import('pg');
  const pool = new Pool({
    connectionString: url,
    ssl: /localhost|127\.0\.0\.1/.test(url) ? undefined : { rejectUnauthorized: false },
    max: 5,
  });
  await pool.query(SCHEMA);
  return {
    query: (sql, params) => pool.query(sql, params as unknown[]) as never,
    async transaction(fn) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await fn({ query: (sql, params) => client.query(sql, params as unknown[]) as never });
        await client.query('COMMIT');
        return result;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    },
  };
}

async function createPgliteDb(): Promise<Db> {
  const { PGlite } = await import('@electric-sql/pglite');
  const dir = process.env.PGLITE_DIR ?? './.data/pglite';
  if (dir !== 'memory') {
    const { mkdirSync } = await import('node:fs');
    mkdirSync(dir, { recursive: true });
  }
  const pg = dir === 'memory' ? new PGlite() : new PGlite(dir);
  await pg.exec(SCHEMA);
  return {
    query: (sql, params) => pg.query(sql, params) as never,
    transaction: (fn) => pg.transaction((tx) => fn({ query: (sql, params) => tx.query(sql, params) as never })),
  };
}

const globalForDb = globalThis as unknown as { __pushifyDb?: Promise<Db> };

export function getDb(): Promise<Db> {
  if (!globalForDb.__pushifyDb) {
    const url = process.env.DATABASE_URL;
    globalForDb.__pushifyDb = (url ? createPgDb(url) : createPgliteDb()).catch((err) => {
      globalForDb.__pushifyDb = undefined;
      throw err;
    });
  }
  return globalForDb.__pushifyDb;
}
