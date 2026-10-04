import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const defaultDirectory = fileURLToPath(new URL('./migrations/', import.meta.url));
const lockName = 'payd.schema_migrations';

/** Run the same ordered, checksum-tracked SQL files from the CLI or staging. */
export async function runMigrations(client, { directory = defaultDirectory, dryRun = false, log = console.log } = {}) {
  const names = (await fs.readdir(directory)).filter(name => name.endsWith('.sql')).sort();
  const files = await Promise.all(names.map(async filename => {
    const sql = await fs.readFile(path.join(directory, filename), 'utf8');
    return { filename, sql, checksum: crypto.createHash('sha256').update(sql).digest('hex') };
  }));
  if (!files.length) throw new Error(`No SQL migrations found in ${directory}`);

  await client.query('SELECT pg_advisory_lock(hashtext($1))', [lockName]);
  try {
    const { rows: [tables] } = await client.query(
      "SELECT to_regclass('public.schema_migrations') AS ledger, to_regclass('public.organizations') AS organizations"
    );
    if (!tables.ledger && tables.organizations) {
      throw new Error('Existing database has no migration ledger. Preserve the volume and reconcile its applied migrations before running the full migration chain; see staging/README.md.');
    }
    const applied = new Map(tables.ledger
      ? (await client.query('SELECT filename, checksum FROM schema_migrations')).rows.map(row => [row.filename, row.checksum])
      : []);
    const drift = files.filter(file => applied.has(file.filename) && applied.get(file.filename) !== file.checksum);
    if (drift.length) throw new Error(`Migration checksum drift: ${drift.map(file => file.filename).join(', ')}. No pending migrations were applied.`);

    if (!dryRun && !tables.ledger) {
      await client.query(`CREATE TABLE schema_migrations (
        id SERIAL PRIMARY KEY, filename VARCHAR(255) NOT NULL UNIQUE,
        checksum CHAR(64) NOT NULL, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        applied_by VARCHAR(255) NOT NULL DEFAULT current_user,
        execution_ms INTEGER CHECK (execution_ms >= 0)
      )`);
    }
    const result = { applied: [], skipped: [] };
    for (const file of files) {
      if (applied.has(file.filename)) {
        result.skipped.push(file.filename);
        continue;
      }
      if (dryRun) {
        log(`[migrate] Would apply ${file.filename}`);
        result.applied.push(file.filename);
        continue;
      }
      const started = Date.now();
      await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
      try {
        await client.query(file.sql);
        await client.query(
          'INSERT INTO schema_migrations (filename, checksum, execution_ms) VALUES ($1, $2, $3)',
          [file.filename, file.checksum, Date.now() - started]
        );
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw new Error(`${file.filename}: ${error.message}`, { cause: error });
      }
      log(`[migrate] Applied ${file.filename}`);
      result.applied.push(file.filename);
    }
    log(`[migrate] ${result.applied.length} applied, ${result.skipped.length} already recorded${dryRun ? ' (dry run)' : ''}`);
    return result;
  } finally {
    await client.query('SELECT pg_advisory_unlock(hashtext($1))', [lockName]);
  }
}
