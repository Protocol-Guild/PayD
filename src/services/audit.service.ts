import pino from 'pino';
import Redis from 'ioredis';

const redis = new Redis(process.env.AUDIT_REDIS_URL || process.env.REDIS_URL || 'redis://localhost:6379');

const logger = pino({
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
    },
  },
  base: {
    service: 'audit',
  },
});

export interface AuditLogEntry {
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

class AuditService {
  private readonly batchSize = 50;
  private readonly buffer: AuditLogEntry[] = [];
  private flushInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.flushInterval = setInterval(() => this.flush(), 5000);
  }

  info(message: string, metadata: Partial<AuditLogEntry>): void {
    this.log('info', message, metadata);
  }

  error(message: string, metadata: Partial<AuditLogEntry>): void {
    this.log('error', message, metadata);
  }

  warn(message: string, metadata: Partial<AuditLogEntry>): void {
    this.log('warn', message, metadata);
  }

  private log(level: 'info' | 'warn' | 'error', message: string, metadata: Partial<AuditLogEntry>): void {
    const entry: AuditLogEntry = {
      id: crypto.randomUUID(),
      tenantId: metadata.tenantId ?? 'system',
      action: metadata.action ?? message,
      entityType: metadata.entityType ?? 'system',
      entityId: metadata.entityId ?? null,
      userId: metadata.userId ?? null,
      ipAddress: metadata.ipAddress ?? 'unknown',
      userAgent: metadata.userAgent ?? '',
      timestamp: metadata.timestamp ?? new Date(),
      sessionId: metadata.sessionId ?? '',
      ...metadata,
    };

    this.buffer.push(entry);

    if (this.buffer.length >= this.batchSize) {
      this.flushBuffer();
    }
  }

  private async flushBuffer(): Promise<void> {
    if (this.buffer.length === 0) return;

    const batch = this.buffer.splice(0, this.batchSize);

    try {
      const pipeline = redis.pipeline();
      for (const entry of batch) {
        const key = `audit:${entry.tenantId}:${entry.id}`;
        pipeline.hset(key, {
          ...entry,
          timestamp: entry.timestamp.toISOString(),
        } as Record<string, string>);
        pipeline.expire(key, 2592000);
      }
      await pipeline.exec();
    } catch (error) {
      logger.error('Failed to flush audit buffer', { error: String(error), count: batch.length });
    }
  }

  async flush(): Promise<void> {
    if (this.buffer.length > 0) {
      await this.flushBuffer();
    }
  }

  async getAuditLogs(
    tenantId: string,
    options: {
      entityType?: string;
      entityId?: string;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<{ logs: AuditLogEntry[]; total: number }> {
    const prefix = `audit:${tenantId}:`;
    const cursor = '0';

    const [scanCursor, count] = await Promise.all([
      redis.scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', options.limit ?? 20),
      redis.zcard(`audit:count:${tenantId}`),
    ]);

    const keys = (scanCursor[1] as string[]).slice(0, options.limit ?? 20);
    const logs = keys.length > 0 ? await redis.mget(...keys) : [];

    return {
      logs: logs.map((log) => (typeof log === 'string' ? JSON.parse(log) : log)) as AuditLogEntry[],
      total: Number(count),
    };
  }

  async getAuditLog(tenantId: string, logId: string): Promise<AuditLogEntry | null> {
    const data = await redis.hgetall(`audit:${tenantId}:${logId}`);
    return data && Object.keys(data).length > 0 ? (data as unknown as AuditLogEntry) : null;
  }

  async purgeOldLogs(tenantId: string, daysToKeep: number = 90): Promise<number> {
    const cutoff = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
    const pattern = `audit:${tenantId}:*`;

    let deleted = 0;
    let cursor = '0';
    do {
      const [newCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = newCursor;
      if (keys.length > 0) {
        await redis.del(...keys);
        deleted += keys.length;
      }
    } while (cursor !== '0');

    return deleted;
  }

  destroy(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    this.flushBuffer();
  }
}

let instance: AuditService | null = null;

export function getAuditLogger(): AuditService {
  if (!instance) {
    instance = new AuditService();
  }
  return instance;
}

export function destroyAuditLogger(): void {
  if (instance) {
    instance.destroy();
    instance = null;
  }
}
