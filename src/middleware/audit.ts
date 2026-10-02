import { Request, Response, NextFunction } from 'express';
import { getAuditLogger } from '../services/audit.service';
import { getTenantId } from '../utils/tenant-context';

export interface AuditEntry {
  id: string;
  tenantId: string;
  action: string;
  entityType: string;
  entityId: string | null;
  userId: string | null;
  previousState?: Record<string, unknown>;
  newState?: Record<string, unknown>;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
  sessionId: string;
}

export function auditRequest(req: Request, res: Response, next: NextFunction): void {
  const tenantId = getTenantId(req);
  const auditLogger = getAuditLogger();

  const entry: Partial<AuditEntry> = {
    tenantId,
    action: `${req.method} ${req.path}`,
    entityType: req.route?.path ? extractEntityType(req.route.path) : 'request',
    entityId: req.params.id ?? null,
    userId: req.user?.id ?? null,
    ipAddress: getClientIp(req),
    userAgent: req.get('User-Agent') ?? '',
    timestamp: new Date(),
    sessionId: req.sessionId ?? null,
  };

  auditLogger.info('Request received', { ...entry });

  res.on('finish', () => {
    auditLogger.info('Request completed', {
      ...entry,
      statusCode: res.statusCode,
      durationMs: res.locals?.durationMs,
    });
  });

  next();
}

function extractEntityType(routePath: string): string {
  const patterns: Record<string, string> = {
    '/api/v1/payments': 'payment',
    '/api/v1/transfers': 'transfer',
    '/api/v1/accounts': 'account',
    '/api/v1/users': 'user',
    '/api/v1/tenants': 'tenant',
    '/api/v1/webhooks': 'webhook',
  };

  for (const [path, entityType] of Object.entries(patterns)) {
    if (routePath.startsWith(path)) return entityType;
  }
  return 'generic';
}

function getClientIp(req: Request): string {
  return (
    req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() ||
    req.socket.remoteAddress ?? 'unknown'
  );
}

export function wrapAuditWithState(
  entityType: string,
  getIdFields: (req: Request) => { id: string; fields: string[] },
) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const tenantId = getTenantId(req);
    const auditLogger = getAuditLogger();
    const { id, fields } = getIdFields(req);

    try {
      await next();
    } catch (error) {
      auditLogger.error('Audit wrapped request failed', {
        tenantId,
        entityType,
        entityId: id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  };
}
