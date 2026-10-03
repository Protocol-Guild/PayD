import type { PoolClient } from 'pg';
import { pool } from './database.js';

/** Run tenant-scoped queries on one client, without retaining tenant state in the pool. */
export async function withTenantTransaction<T>(
  organizationId: number,
  operation: (client: PoolClient) => Promise<T>
): Promise<T> {
  if (!Number.isSafeInteger(organizationId) || organizationId <= 0) {
    throw new Error('A positive organization ID is required for tenant queries');
  }

  const client = await pool.connect();
  let releaseError: Error | undefined;
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [
      String(organizationId),
    ]);
    const result = await operation(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      // An unconfirmed rollback must never put a dirty connection back in the pool.
      releaseError = rollbackError instanceof Error
        ? rollbackError
        : new Error('Tenant transaction rollback failed');
    }
    throw error;
  } finally {
    client.release(releaseError);
  }
}
