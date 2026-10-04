import { AsyncLocalStorage } from 'node:async_hooks';
import { Pool, type PoolClient } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

export interface DatabaseTenantContext {
  tenantId?: number;
  userId?: number;
}

const tenantContext = new AsyncLocalStorage<Readonly<DatabaseTenantContext>>();

export function runWithTenantContext<T>(context: DatabaseTenantContext, operation: () => T): T {
  for (const id of [context.tenantId, context.userId]) {
    if (id !== undefined && (!Number.isSafeInteger(id) || id <= 0)) {
      throw new Error('Database tenant and user IDs must be positive integers');
    }
  }
  return tenantContext.run(Object.freeze({ ...context }), operation);
}

const SET_CONTEXT_SQL = `SELECT
  set_config('app.current_tenant_id', $1, false),
  set_config('app.current_user_id', $2, false)`;

type ConnectCallback = Parameters<Pool['connect']>[0];

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

/**
 * Each checkout owns its session context until release. Pool.query also goes
 * through connect, so service queries and explicit transactions use the same
 * tenant rules without sharing or prematurely committing a transaction.
 */
export class TenantPool extends Pool {
  override connect(): Promise<PoolClient>;
  override connect(callback: ConnectCallback): void;
  override connect(callback?: ConnectCallback): Promise<PoolClient> | void {
    // Capture before waiting: another tenant may release the next free client.
    const connection = this.checkout(tenantContext.getStore());
    if (callback) {
      void connection.then(
        (client) => callback(undefined, client, client.release),
        (error: unknown) => callback(asError(error), undefined, () => {}),
      );
      return;
    }
    return connection;
  }

  private async checkout(context?: Readonly<DatabaseTenantContext>): Promise<PoolClient> {
    const client = await super.connect();
    const releaseToPool = client.release.bind(client);
    // A checked-out pg client has no idle-pool error listener. Keep transport
    // failures handled while the caller is still waiting for initialization.
    const setupErrorListener = () => {};
    client.on('error', setupErrorListener);
    try {
      await client.query(SET_CONTEXT_SQL, [
        context?.tenantId?.toString() ?? '',
        context?.userId?.toString() ?? '',
      ]);
    } catch (error) {
      releaseToPool(asError(error));
      throw error;
    } finally {
      client.removeListener('error', setupErrorListener);
    }

    let released = false;
    const release = (error?: Error | boolean): void => {
      if (released) throw new Error('Release called on client which has already been released to the pool.');
      released = true;
      if (error) {
        releaseToPool(error);
        return;
      }

      // Do not make this session available until cleanup has completed. A
      // forgotten/failed transaction must not prevent clearing session state.
      let returned = false;
      const finishRelease = (cleanupError?: Error): void => {
        if (returned) return;
        returned = true;
        client.removeListener('error', onCleanupError);
        releaseToPool(cleanupError);
      };
      const onCleanupError = (cleanupError: Error): void => finishRelease(cleanupError);
      client.on('error', onCleanupError);
      void (async () => {
        try {
          await client.query('ROLLBACK');
          await client.query(SET_CONTEXT_SQL, ['', '']);
          finishRelease();
        } catch (cleanupError) {
          // A connection whose state cannot be cleared must never be reused.
          finishRelease(asError(cleanupError));
        }
      })();
    };

    // A lease is distinct from the reusable pg client. Stale references cannot
    // query or release a connection after it has been assigned to another user.
    const lease: PoolClient = new Proxy(client, {
      get(target, property) {
        if (property === 'release') return release;
        const value = Reflect.get(target, property, target);
        if (typeof value !== 'function') return value;
        return (...args: unknown[]) => {
          if (property === 'query' && released) {
            throw new Error('Cannot query a released database client');
          }
          const result = Reflect.apply(value, target, args);
          return result === target ? lease : result;
        };
      },
    });
    return lease;
  }
}

const pool = new TenantPool({
  connectionString: process.env.DATABASE_URL,
});
pool.on('error', (error) => {
  // pg has already discarded an idle connection that suffers a transport
  // error. Log the message without dumping the client or its credentials.
  console.error('Unexpected idle database connection error:', error.message);
});

export const query = (text: string, params?: any[]) => pool.query(text, params);
export { pool };
export default pool;
