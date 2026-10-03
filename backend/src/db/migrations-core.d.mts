import type { Client, PoolClient } from 'pg';

export function runMigrations(
  client: Client | PoolClient,
  options?: { directory?: string; dryRun?: boolean; log?: (message: string) => void }
): Promise<{ applied: string[]; skipped: string[] }>;
