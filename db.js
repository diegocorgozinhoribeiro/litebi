'use strict';
/*
 * db.js — conexão com o Postgres (Neon) e criação das tabelas.
 */
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.warn('[LiteBI] AVISO: DATABASE_URL não definida. Configure a variável de ambiente.');
}

// Neon exige SSL. rejectUnauthorized:false evita problemas de cadeia de certificados
// em provedores gerenciados como Render/Neon.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  application_name: 'litebi',
  max: Math.max(2, Number(process.env.DB_POOL_MAX) || 10),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  statement_timeout: 15000,
  idle_in_transaction_session_timeout: 15000,
  keepAlive: true,
});

pool.on('error', (err) => {
  console.error('[LiteBI] Erro inesperado no pool do Postgres:', err.message);
});

async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id            SERIAL PRIMARY KEY,
      email         TEXT UNIQUE NOT NULL,
      password_hash TEXT,
      name          TEXT,
      google_id     TEXT UNIQUE,
      avatar_url    TEXT,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS dashboards (
      id          SERIAL PRIMARY KEY,
      slug        TEXT UNIQUE NOT NULL,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title       TEXT NOT NULL DEFAULT 'Dashboard',
      visibility  TEXT NOT NULL DEFAULT 'private',
      payload     JSONB NOT NULL,
      html        TEXT NOT NULL,
      views       INTEGER NOT NULL DEFAULT 0,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_dashboards_user ON dashboards(user_id);
    CREATE INDEX IF NOT EXISTS idx_dashboards_user_updated ON dashboards(user_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_dashboards_public_updated ON dashboards(updated_at DESC) WHERE visibility = 'public';
  `);

  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT NOT NULL DEFAULT '';
    ALTER TABLE users ADD COLUMN IF NOT EXISTS legal_accepted_at TIMESTAMPTZ;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_version TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS privacy_version TEXT;
    CREATE TABLE IF NOT EXISTS friendships (
      id           SERIAL PRIMARY KEY,
      requester_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      addressee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status       TEXT NOT NULL DEFAULT 'pending',
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
      CHECK (requester_id <> addressee_id),
      UNIQUE (requester_id, addressee_id)
    );
    CREATE INDEX IF NOT EXISTS idx_friendships_addressee ON friendships(addressee_id, status);
    CREATE INDEX IF NOT EXISTS idx_friendships_requester ON friendships(requester_id, status);
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS teams (
      id         SERIAL PRIMARY KEY,
      name       TEXT NOT NULL,
      owner_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS team_members (
      team_id    INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role       TEXT NOT NULL DEFAULT 'member',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (team_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS dashboard_shares (
      dashboard_id INTEGER NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE,
      team_id      INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      permission   TEXT NOT NULL DEFAULT 'viewer',
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (dashboard_id, team_id)
    );
    CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id);
    CREATE INDEX IF NOT EXISTS idx_dashboard_shares_team ON dashboard_shares(team_id);
    CREATE INDEX IF NOT EXISTS idx_dashboard_shares_dashboard ON dashboard_shares(dashboard_id);
  `);

  console.log('[LiteBI] Tabelas verificadas/criadas com sucesso.');
}

module.exports = { pool, init };
