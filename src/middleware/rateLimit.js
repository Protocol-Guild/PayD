const { redisClient } = require('../config/database');

class RateLimiter {
  constructor(options = {}) {
    this.windowMs = options.windowMs || 60000;
    this.maxRequests = options.maxRequests || 100;
    this.store = options.store || 'redis';
  }

  async check(key, limit = null, window = null) {
    const maxRequests = limit || this.maxRequests;
    const windowMs = window || this.windowMs;
    const now = Date.now();
    const windowStart = now - windowMs;

    if (this.store === 'redis' && redisClient) {
      const pipeline = redisClient.pipeline();
      pipeline.incr(`ratelimit:${key}`);
      pipeline.expireat(`ratelimit:${key}`, Math.ceil((now + windowMs) / 1000));
      pipeline.zremrangebyscore(`ratelimit:window:${key}`, 0, windowStart);
      pipeline.zadd(`ratelimit:window:${key}`, now.toString(), `${now}:${Math.random()}`);
      pipeline.zcard(`ratelimit:window:${key}`);
      const results = await pipeline.exec();
      const count = results[3][1];

      return {
        allowed: count <= maxRequests,
        remaining: Math.max(0, maxRequests - count),
        resetAt: Math.ceil((now + windowMs) / 1000) * 1000,
        limit: maxRequests
      };
    }

    // Memory fallback
    if (!this._memoryStore) this._memoryStore = new Map();
    let entries = this._memoryStore.get(key) || [];
    entries = entries.filter(t => t > windowStart);
    entries.push(now);
    this._memoryStore.set(key, entries);

    return {
      allowed: entries.length <= maxRequests,
      remaining: Math.max(0, maxRequests - entries.length),
      resetAt: now + windowMs,
      limit: maxRequests
    };
  }

  middleware(options = {}) {
    const { keyGenerator, limit, window } = options;
    return async (req, res, next) => {
      const key = keyGenerator ? keyGenerator(req) : `${req.ip}:${req.originalUrl}`;
      const result = await this.check(key, limit, window);

      res.setHeader('X-RateLimit-Limit', result.limit);
      res.setHeader('X-RateLimit-Remaining', result.remaining);
      res.setHeader('X-RateLimit-Reset', result.resetAt);

      if (!result.allowed) {
        req.audit?.record('rate_limit_exceeded', { key, limit: result.limit });
        return res.status(429).json({
          error: 'Too Many Requests',
          retryAfter: Math.ceil((result.resetAt - Date.now()) / 1000)
        });
      }
      next();
    };
  }
}

const rateLimiter = new RateLimiter();
const apiRateLimit = rateLimiter.middleware({
  keyGenerator: (req) => `${req.ip}:${req.user?.tenantId || 'public'}:${req.method}:${req.baseUrl}`,
  limit: 100,
  window: 60000
});

const strictRateLimit = rateLimiter.middleware({
  keyGenerator: (req) => `${req.ip}:${req.originalUrl}`,
  limit: 20,
  window: 60000
});

module.exports = { RateLimiter, rateLimiter, apiRateLimit, strictRateLimit };
