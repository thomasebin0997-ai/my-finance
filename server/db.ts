import pg from "pg";
import { env } from "./env";

// NUMERIC -> number, DATE -> 'YYYY-MM-DD' string (no time-zone shifting).
pg.types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)));
pg.types.setTypeParser(1082, (v) => v);

/**
 * TLS rules: hosted databases (Neon, Supabase, Render external URLs…) get TLS;
 * localhost and Render's internal hostnames (no dot, e.g. dpg-xxxx-a) don't.
 * `sslmode` in the URL, or DATABASE_SSL=true, overrides the guess.
 */
function connectionConfig(raw: string): pg.PoolConfig {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { connectionString: raw, ssl: env.databaseSsl ? { rejectUnauthorized: false } : undefined };
  }
  const host = url.hostname;
  const local = host === "localhost" || host === "127.0.0.1" || host === "[::1]" || !host.includes(".");
  const sslmode = url.searchParams.get("sslmode");
  // Handle TLS here instead of letting the driver interpret these parameters.
  url.searchParams.delete("sslmode");
  url.searchParams.delete("channel_binding");
  const useSsl = env.databaseSsl || (sslmode ? sslmode !== "disable" : !local);
  return { connectionString: url.toString(), ssl: useSsl ? { rejectUnauthorized: false } : undefined };
}

export const pool = new pg.Pool({ ...connectionConfig(env.databaseUrl), max: 5 });

export async function tx<T>(fn: (c: pg.PoolClient) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const r = await fn(c);
    await c.query("COMMIT");
    return r;
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}

/** Ordered schema migrations. Append new ones; never edit an applied one. */
const MIGRATIONS: { id: number; sql: string }[] = [
  {
    id: 1,
    sql: `
      CREATE TABLE accounts (
        id          text PRIMARY KEY,
        name        text NOT NULL,
        type        text NOT NULL DEFAULT 'savings',
        opening     numeric(14,2) NOT NULL DEFAULT 0,
        sample      boolean NOT NULL DEFAULT false,
        created_at  timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE emis (
        id           text PRIMARY KEY,
        name         text NOT NULL,
        lender       text NOT NULL DEFAULT '',
        emi          numeric(14,2) NOT NULL CHECK (emi > 0),
        due_day      int NOT NULL CHECK (due_day BETWEEN 1 AND 31),
        start_month  char(7) NOT NULL,
        tenure       int NOT NULL CHECK (tenure > 0),
        paid_before  int NOT NULL DEFAULT 0 CHECK (paid_before >= 0),
        loan_amount  numeric(14,2) NOT NULL DEFAULT 0,
        account_id   text REFERENCES accounts(id) ON DELETE SET NULL,
        closed       boolean NOT NULL DEFAULT false,
        sample       boolean NOT NULL DEFAULT false,
        created_at   timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE chits (
        id                  text PRIMARY KEY,
        name                text NOT NULL,
        company             text NOT NULL DEFAULT '',
        chit_value          numeric(14,2) NOT NULL CHECK (chit_value > 0),
        installment         numeric(14,2) NOT NULL CHECK (installment > 0),
        months              int NOT NULL CHECK (months > 0),
        due_day             int NOT NULL CHECK (due_day BETWEEN 1 AND 31),
        start_month         char(7) NOT NULL,
        account_id          text REFERENCES accounts(id) ON DELETE SET NULL,
        paid_before         int NOT NULL DEFAULT 0 CHECK (paid_before >= 0),
        paid_before_amount  numeric(14,2),
        sample              boolean NOT NULL DEFAULT false,
        created_at          timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE txns (
        id             text PRIMARY KEY,
        type           text NOT NULL CHECK (type IN ('income','expense','transfer')),
        amount         numeric(14,2) NOT NULL CHECK (amount > 0),
        date           date NOT NULL,
        account_id     text REFERENCES accounts(id) ON DELETE SET NULL,
        to_account_id  text REFERENCES accounts(id) ON DELETE SET NULL,
        category       text NOT NULL DEFAULT 'Other',
        note           text NOT NULL DEFAULT '',
        kind           text CHECK (kind IN ('emi','chit','chitprize')),
        emi_id         text REFERENCES emis(id) ON DELETE SET NULL,
        chit_id        text REFERENCES chits(id) ON DELETE SET NULL,
        period         char(7),
        chit_due       numeric(14,2),
        sample         boolean NOT NULL DEFAULT false,
        created_at     timestamptz NOT NULL DEFAULT now(),
        updated_at     timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX txns_date_idx ON txns (date DESC);
      CREATE INDEX txns_account_idx ON txns (account_id);
      -- One payment per EMI / chitty per month; one prize per chitty.
      CREATE UNIQUE INDEX txns_emi_period_uq  ON txns (emi_id, period)  WHERE kind = 'emi';
      CREATE UNIQUE INDEX txns_chit_period_uq ON txns (chit_id, period) WHERE kind = 'chit';
      CREATE UNIQUE INDEX txns_chit_prize_uq  ON txns (chit_id)         WHERE kind = 'chitprize';

      CREATE TABLE settings (
        id    int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
        data  jsonb NOT NULL
      );

      -- One reminder message per day at most.
      CREATE TABLE reminder_runs (
        day      date PRIMARY KEY,
        sent_at  timestamptz NOT NULL DEFAULT now(),
        items    int NOT NULL,
        channels text NOT NULL
      );
    `,
  },
];

export async function migrate(): Promise<void> {
  await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (id int PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`);
  const { rows } = await pool.query<{ id: number }>("SELECT id FROM schema_migrations");
  const done = new Set(rows.map((r) => r.id));
  for (const m of MIGRATIONS) {
    if (done.has(m.id)) continue;
    await tx(async (c) => {
      await c.query(m.sql);
      await c.query("INSERT INTO schema_migrations (id) VALUES ($1)", [m.id]);
    });
    console.log(`[db] applied migration ${m.id}`);
  }
}
