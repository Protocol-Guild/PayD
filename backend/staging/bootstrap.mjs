import fs from 'node:fs/promises';
import pg from 'pg';
import { runMigrations } from '../src/db/migrations-core.mjs';

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} must be set`);
  return value;
}

async function main() {
  const appUser = required('STAGING_DB_USER');
  const appPassword = required('STAGING_DB_PASSWORD');
  const adminUser = required('STAGING_DB_ADMIN_USER');
  if (Buffer.byteLength(appUser, 'utf8') > 63) throw new Error('STAGING_DB_USER exceeds the PostgreSQL identifier limit.');
  if (appUser === adminUser) throw new Error('STAGING_DB_USER must differ from STAGING_DB_ADMIN_USER; the API cannot use the migration owner.');
  const client = new pg.Client({
    host: process.env.PGHOST || 'postgres', port: Number(process.env.PGPORT || 5432),
    database: required('STAGING_DB_NAME'), user: adminUser,
    password: required('STAGING_DB_ADMIN_PASSWORD'), connectionTimeoutMillis: 10_000,
  });
  try {
    await client.connect();
    await client.query("SELECT pg_advisory_lock(hashtext('payd.staging.bootstrap'))");
    const { rows: [existing] } = await client.query(
      'SELECT oid, rolsuper, rolbypassrls, rolcreatedb, rolcreaterole, rolreplication FROM pg_roles WHERE rolname = $1', [appUser]
    );
    if (existing) {
      const { rows: [ownership] } = await client.query(`SELECT
        EXISTS(SELECT 1 FROM pg_class WHERE relowner = $1 AND relnamespace = 'public'::regnamespace)
        OR EXISTS(SELECT 1 FROM pg_database WHERE datdba = $1)
        OR EXISTS(SELECT 1 FROM pg_auth_members WHERE member = $1) AS privileged`, [existing.oid]);
      if (existing.rolsuper || existing.rolbypassrls || existing.rolcreatedb || existing.rolcreaterole || existing.rolreplication || ownership.privileged) {
        throw new Error('STAGING_DB_USER already owns objects or has privileged roles. Choose a separate unprivileged application role; the existing role was not changed.');
      }
    }
    await runMigrations(client);
    await client.query('BEGIN');
    try {
      await client.query(`CREATE TABLE IF NOT EXISTS staging_bootstrap (
        name TEXT PRIMARY KEY, completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`);
      const seed = await client.query("SELECT 1 FROM staging_bootstrap WHERE name = 'seed-v1'");
      if (!seed.rowCount) {
        await client.query(await fs.readFile(new URL('../src/db/seed.sql', import.meta.url), 'utf8'));
        await client.query("INSERT INTO staging_bootstrap (name) VALUES ('seed-v1')");
        console.log('[staging] Seed applied');
      }
      const role = pg.escapeIdentifier(appUser);
      if (!existing) await client.query(`CREATE ROLE ${role} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT`);
      await client.query(`ALTER ROLE ${role} LOGIN PASSWORD ${pg.escapeLiteral(appPassword)}`);
      const { rows: [{ database }] } = await client.query('SELECT current_database() AS database');
      await client.query(`GRANT CONNECT ON DATABASE ${pg.escapeIdentifier(database)} TO ${role}`);
      await client.query(`GRANT USAGE ON SCHEMA public TO ${role}`);
      await client.query('REVOKE CREATE ON SCHEMA public FROM PUBLIC');
      await client.query(`REVOKE CREATE ON SCHEMA public FROM ${role}`);
      await client.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${role}`);
      await client.query(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${role}`);
      await client.query(`REVOKE ALL ON schema_migrations, staging_bootstrap FROM ${role}`);
      await client.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${role}`);
      await client.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO ${role}`);
      await client.query(`ALTER ROLE ${role} IN DATABASE ${pg.escapeIdentifier(database)} SET row_security = on`);
      // PG15 views must use the application's RLS policies, not the owner role.
      const views = await client.query("SELECT viewname FROM pg_views WHERE schemaname = 'public'");
      for (const { viewname } of views.rows) {
        await client.query(`ALTER VIEW public.${pg.escapeIdentifier(viewname)} SET (security_invoker = true)`);
      }
      await client.query('COMMIT');
      console.log('[staging] Database ready; API role is separate from the migration owner');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  } finally {
    await client.end();
  }
}

main().catch(error => {
  console.error('[staging]', error.message);
  process.exitCode = 1;
});
