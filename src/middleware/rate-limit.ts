import { RateLimiterRedis } from 'rate-limiter-flexible';
import Redis from 'ioredis';
import { Request, Response, NextFunction } from 'express';
import { getTenantId } from '../utils/tenant-context';
import type { TenantConfig } from '../models/tenant';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

interface RateLimitConfig {
  points: number;
  duration: number;
  keyPrefix: string;
}

const DEFAULT_LIMITS: Record<string, RateLimitConfig> = {
  default: { points: 100, duration: 60, keyPrefix: 'rl:default' },
  api: { points: 60, duration: 60, keyPrefix: 'rl:api' },
  auth: { points: 5, duration: 300, keyPrefix: 'rl:auth' },
  webhook: { points: 30, duration: 60, keyPrefix: 'rl:webhook' },
  heavy: { points: 10, duration: 60, keyPrefix: 'rl:heavy' },
};

const rateLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: 'rate-limit',
  ttl: 60,
  points: 100,
});

export interface RateLimitHeaders {
  'X-RateLimit-Limit': string;
  'X-RateLimit-Remaining': string;
  'X-RateLimit-Reset': string;
}

function getRateLimitKey(req: Request, config: RateLimitConfig): string {
  const tenantId = getTenantId(req);
  const identifier = config.keyPrefix === 'rl:auth'
    ? req.body?.email || req.ip
    : req.ip;
  return `${config.keyPrefix}:${tenantId}:${identifier}`;
}

export function rateLimit(
  config: Partial<RateLimitConfig> = {},
  customKeyExtractor?: (req: Request) => string,
) {
  const mergedConfig: RateLimitConfig = { ...DEFAULT_LIMITS.default, ...config };

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const key = customKeyExtractor
        ? customKeyExtractor(req)
        : getRateLimitKey(req, mergedConfig);

      const rateLimiterRes = await rateLimiter.consume(key, mergedConfig.points, {
        duration: mergedConfig.duration,
      });

      const resetTime = Math.floor(Date.now() / 1000) + mergedConfig.duration;

      res.setHeader('X-RateLimit-Limit', String(mergedConfig.points));
      res.setHeader('X-RateLimit-Remaining', String(rateLimiterRes.remainingPoints));
      res.setHeader('X-RateLimit-Reset', String(resetTime));

      if (rateLimiterRes.consumedPoints > mergedConfig.points * 0.8) {
        res.setHeader('X-RateLimit-Warn', 'true');
      }

      next();
    } catch (error) {
      if (error.constructor.name === 'RateLimiterRes' || (error as { consumdedPoints?: number }).consumedPoints) {
        const rlError = error as { consumedPoints: number; remainingPoints: number; secondsUntilReset: number };
        res.setHeader('Retry-After', String(rlError.secondsUntilReset));
        res.status(429).json({
          error: 'Too Many Requests',
          message: 'Rate limit exceeded. Please try again later.',
          retryAfter: rlError.secondsUntilReset,
          limit: mergedConfig.points,
        });
        return;
      }
      next(error);
    }
  };
}

export async function checkRateLimit(key: string, points: number, duration: number): Promise<{
  consumed: number;
  remaining: number;
  reset: number;
}> {
  const res = await rateLimiter.consume(key, points, { duration });
  return {
    consumed: res.consumedPoints,
    remaining: res.remainingPoints,
    reset: Math.floor(Date.now() / 1000) + duration,
  };
}

export async function incrementRateLimit(key: string, points: number, duration: number): Promise<void> {
  await rateLimiter.increment(key, points, { duration });
}

export async function clearRateLimitKey(key: string): Promise<void> {
  await redis.del(key);
}

export async function getTenantRateLimits(tenantId: string): Promise<Record<string, number>> {
  const limits: Record<string, number> = {};
  for (const [name, config] of Object.entries(DEFAULT_LIMITS)) {
    const key = `${config.keyPrefix}:${tenantId}:global`;
    const res = await rateLimiter.get(key);
    limits[name] = res ? res.consumedPoints : 0;
  }
  return limits;
}
