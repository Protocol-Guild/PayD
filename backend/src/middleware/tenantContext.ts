import { Request, Response, NextFunction } from 'express';
import type { PoolClient } from 'pg';
import { pool, runWithTenantContext, type DatabaseTenantContext } from '../config/database.js';

type RequestDatabaseClient = Pick<PoolClient, 'query' | 'release'>;

// Extend Express Request to include tenant information
declare global {
  namespace Express {
    interface Request {
      tenantId?: number;
      organizationId?: number; // Alias for clarity
      dbClient?: RequestDatabaseClient | null;
    }
  }
}

function positiveTenantId(value: unknown): number | undefined {
  if (typeof value === 'string' && !/^\d+$/.test(value)) return undefined;
  if (typeof value !== 'string' && typeof value !== 'number') return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
}

export class TenantContextMismatchError extends Error {}

const requestContexts = new WeakMap<Request, DatabaseTenantContext>();

/** Allocate a request-owned connection only when a legacy dbClient query is used. */
function createRequestClient(context: DatabaseTenantContext): RequestDatabaseClient {
  let connection: Promise<PoolClient> | undefined;
  let released = false;
  const getConnection = (): Promise<PoolClient> => {
    if (released) return Promise.reject(new Error('Request database client has been released'));
    connection ??= runWithTenantContext(context, () => pool.connect());
    return connection;
  };

  const query = (...args: unknown[]) => {
    const lastArgument = args[args.length - 1];
    const callback = typeof lastArgument === 'function' ? lastArgument : undefined;
    if (callback) args.pop();
    const result = getConnection().then((client) => Reflect.apply(client.query, client, args));
    if (callback) {
      void result.then(
        (value) => Reflect.apply(callback, undefined, [undefined, value]),
        (error: unknown) => Reflect.apply(callback, undefined, [error]),
      );
      return;
    }
    return result;
  };

  return {
    query: query as PoolClient['query'],
    release(error?: Error | boolean) {
      if (released) return;
      released = true;
      if (connection) {
        void connection.then((client) => client.release(error), () => {});
      }
    },
  };
}

/** Shared by both RLS middleware entry points; never opens a request transaction. */
export async function establishTenantContext(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const tenantId = positiveTenantId(req.tenantId);
  if (!tenantId) throw new Error('A valid tenant ID is required');
  if (req.user && req.user.organizationId !== tenantId) {
    throw new TenantContextMismatchError('Cannot access resources outside your organization');
  }
  const context = { tenantId, userId: req.user?.id };
  const previous = requestContexts.get(req);
  if (previous && (previous.tenantId !== tenantId || previous.userId !== context.userId)) {
    throw new TenantContextMismatchError('Cannot change tenant context during a request');
  }

  await runWithTenantContext(context, async () => {
    if (!previous) {
      // Confirm that a correctly initialized connection is available, then
      // return it. Reserving an unused client here could exhaust the pool while
      // downstream services wait for their own transactions/connections.
      const probe = await pool.connect();
      probe.release();
      const client = createRequestClient(context);
      req.dbClient = client;
      requestContexts.set(req, context);
      const cleanup = () => {
        client.release();
        if (req.dbClient === client) req.dbClient = null;
      };
      res.on('finish', cleanup);
      res.on('close', cleanup);
    }
    next();
  });
}

/**
 * Middleware to extract and validate tenant ID from request
 * Supports multiple extraction methods:
 * 1. URL parameter (:organizationId)
 * 2. Request header (X-Organization-Id)
 * 3. Authenticated JWT tenant
 */
export const extractTenantId = (req: Request, res: Response, next: NextFunction) => {
  const tenantId = positiveTenantId(
    req.params.organizationId ?? req.headers['x-organization-id'] ?? req.user?.organizationId,
  );

  // Validate tenant ID
  if (!tenantId || isNaN(tenantId) || tenantId <= 0) {
    return res.status(400).json({
      error: 'Invalid or missing organization ID',
      message: 'A valid organization ID must be provided in the URL or headers',
    });
  }

  if (req.user && req.user.organizationId !== tenantId) {
    return res.status(403).json({
      error: 'Access denied',
      message: 'Cannot access resources outside your organization',
    });
  }

  // Attach to request object
  req.tenantId = tenantId;
  req.organizationId = tenantId; // Alias for backward compatibility

  next();
};

/**
 * Middleware to set PostgreSQL session variable for RLS
 * This must be called after extractTenantId
 */
export const setTenantContext = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.tenantId) {
    return res.status(500).json({
      error: 'Tenant context not set',
      message: 'extractTenantId middleware must be called before setTenantContext',
    });
  }

  try {
    await establishTenantContext(req, res, next);
  } catch (error) {
    if (error instanceof TenantContextMismatchError) {
      return res.status(403).json({ error: 'Access denied', message: error.message });
    }
    console.error('Error setting tenant context:', error);
    return res.status(500).json({
      error: 'Failed to set tenant context',
      message: 'An error occurred while establishing tenant isolation',
    });
  }
};

/**
 * Middleware to verify tenant exists and is active
 * Optional but recommended for additional security
 */
export const validateTenant = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.tenantId) {
    return res.status(500).json({
      error: 'Tenant ID not set',
      message: 'extractTenantId middleware must be called before validateTenant',
    });
  }

  try {
    const result = await pool.query('SELECT id, name FROM organizations WHERE id = $1', [
      req.tenantId,
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Organization not found',
        message: `Organization with ID ${req.tenantId} does not exist`,
      });
    }

    // Optionally attach organization info to request
    (req as any).organization = result.rows[0];

    next();
  } catch (error) {
    console.error('Error validating tenant:', error);
    return res.status(500).json({
      error: 'Failed to validate tenant',
      message: 'An error occurred while validating the organization',
    });
  }
};

/**
 * Combined middleware that handles full tenant context setup
 * Use this for most routes that require tenant isolation
 */
export const requireTenantContext = [extractTenantId, validateTenant, setTenantContext];

/**
 * Lightweight tenant middleware without RLS setup
 * Use for routes that handle tenant context manually
 */
export const requireTenantId = [extractTenantId, validateTenant];

/**
 * Enter the authenticated user's database scope. May run before auth as a
 * no-op, or repeatedly after auth; explicit tenant selections must agree with
 * the signed identity. Async work retains the scope after the response ends.
 */
export const syncTenantFromUser = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    next();
    return;
  }
  const tenantId = req.user.organizationId ?? undefined;
  const selections = [req.tenantId, req.params.organizationId, req.headers['x-organization-id']];
  if (selections.some((value) => value !== undefined && positiveTenantId(value) !== tenantId)) {
    res.status(403).json({ error: 'Access denied', message: 'Cannot access resources outside your organization' });
    return;
  }
  req.tenantId = tenantId;
  req.organizationId = tenantId;
  runWithTenantContext({ tenantId, userId: req.user.id }, next);
};
