import { Request, Response, NextFunction } from 'express';
import { TenantContext, getTenantId, setTenantContext } from '../utils/tenant-context';
import { getTenantFromDatabase } from '../services/tenant.service';
import logger from '../utils/logger';

export async function tenantMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const tenantHeader = req.headers['x-tenant-id'] as string | undefined;
  const tenantSubdomain = req.subdomains[0];
  const tenantParam = req.query.tenantId as string | undefined;
  const tenantPath = req.params.tenantId as string | undefined;

  let tenantId: string | undefined;

  if (tenantHeader) {
    tenantId = tenantHeader;
  } else if (tenantSubdomain && tenantSubdomain !== 'www') {
    tenantId = tenantSubdomain;
  } else if (tenantParam) {
    tenantId = tenantParam;
  } else if (tenantPath) {
    tenantId = tenantPath;
  }

  if (!tenantId) {
    return next();
  }

  try {
    const tenant = await getTenantFromDatabase(tenantId);
    if (!tenant) {
      res.status(404).json({ error: 'Tenant not found', tenantId });
      return;
    }

    if (tenant.status !== 'active') {
      res.status(403).json({ error: 'Tenant is not active', tenantId, status: tenant.status });
      return;
    }

    setTenantContext({
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      plan: tenant.plan,
      createdAt: tenant.createdAt,
    });

    req.tenant = tenant;
    (req as Request & { tenant: typeof tenant }).tenant = tenant;

    next();
  } catch (error) {
    logger.error('Tenant middleware error', { tenantId, error: String(error) });
    res.status(500).json({ error: 'Internal server error' });
  }
}

export function requireTenant(req: Request, res: Response, next: NextFunction): void {
  const tenantId = getTenantId(req);
  if (!tenantId) {
    res.status(400).json({ error: 'Tenant ID required' });
    return;
  }
  next();
}

export function withTenantIsolation<T>(fn: (req: Request, ...args: unknown[]) => Promise<T>) {
  return async (req: Request, ...args: unknown[]): Promise<T> => {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      throw new Error('Tenant context not available');
    }
    return fn(req, ...args);
  };
}

export function getTenantHeader(req: Request): string | undefined {
  return req.headers['x-tenant-id'] as string | undefined;
}
