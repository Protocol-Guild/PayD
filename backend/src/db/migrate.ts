/** Ordered migrations shared by the production CLI and staging bootstrap. */
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import pg from 'pg';
import { runMigrations } from './migrations-core.mjs';

dotenv.config({ path: fileURLToPath(new URL('../../.env', import.meta.url)) });

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL environment variable is not set.');
  const unknown = process.argv.slice(2).filter(arg => arg !== '--dry-run');
  if (unknown.length) throw new Error(`Unsupported argument: ${unknown.join(', ')}`);
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10_000 });
  try {
    await client.connect();
    await runMigrations(client, { dryRun: process.argv.includes('--dry-run') });
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error('[migrate]', error instanceof Error ? error.message : 'Migration failed');
  process.exitCode = 1;
});
