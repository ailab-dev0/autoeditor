/**
 * Neon PostgreSQL connection + schema initialization.
 *
 * Stores users, projects (with user_id ownership), and auth data.
 * Neo4j remains the graph store for segments, concepts, knowledge graph.
 * Postgres is the relational store for CRUD + auth.
 */

import pg from 'pg';
import { config } from '../config.js';

const { Pool } = pg;

let pool: pg.Pool | null = null;

export async function connectPostgres(): Promise<void> {
  if (!config.databaseUrl) {
    console.warn('[postgres] DATABASE_URL not set — skipping Postgres');
    return;
  }

  pool = new Pool({
    connectionString: config.databaseUrl,
    ssl: config.databaseUrl.includes('neon.tech') ? { rejectUnauthorized: false } : undefined,
    max: 10,
    idleTimeoutMillis: 30000,
  });

  // Handle idle connection errors from Neon (drops idle TLS connections)
  pool.on('error', (err) => {
    console.warn('[postgres] Idle pool error (non-fatal, will reconnect):', err.message);
  });

  // Test connection
  const client = await pool.connect();
  try {
    const res = await client.query('SELECT NOW()');
    console.log(`[postgres] Connected to Neon: ${res.rows[0].now}`);
  } finally {
    client.release();
  }
}

export async function initPostgresSchema(): Promise<void> {
  if (!pool) return;

  // Create tables
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'editor',
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // Drop and recreate projects table to ensure correct schema
  // (handles migration from old schema without user_id)
  const hasUserIdCol = await pool.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'user_id'
  `);

  if (hasUserIdCol.rowCount === 0) {
    // Either table doesn't exist or is missing user_id — recreate
    await pool.query(`DROP TABLE IF EXISTS projects CASCADE`);
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS projects (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'created',
      video_paths JSONB DEFAULT '[]',
      source_urls JSONB DEFAULT '[]',
      pipeline_status JSONB,
      edit_package JSONB,
      settings JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // Cost tracking table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS cost_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
      service TEXT NOT NULL,
      operation TEXT NOT NULL,
      model TEXT,
      input_tokens INTEGER DEFAULT 0,
      output_tokens INTEGER DEFAULT 0,
      cost_usd NUMERIC(10, 6) DEFAULT 0,
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // Jobs table for queue persistence
  await pool.query(`
    CREATE TABLE IF NOT EXISTS jobs (
      id UUID PRIMARY KEY,
      type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      payload JSONB DEFAULT '{}',
      result JSONB,
      error TEXT,
      retry_count INTEGER DEFAULT 0,
      max_retries INTEGER DEFAULT 3,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      started_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ
    );
  `);

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_cost_events_project ON cost_events(project_id)`);

  console.log('[postgres] Schema initialized');
}

export function getPool(): pg.Pool | null {
  return pool;
}

export async function query<T extends pg.QueryResultRow = any>(
  text: string,
  params?: any[],
): Promise<pg.QueryResult<T>> {
  if (!pool) throw new Error('Postgres not connected');
  return pool.query<T>(text, params);
}

export async function closePostgres(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('[postgres] Connection closed');
  }
}
