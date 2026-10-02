const { Pool } = require('pg');
const { REDIS_URL } = process.env;
let redisClient = null;

try {
  const Redis = require('ioredis');
  redisClient = new Redis(REDIS_URL || 'redis://localhost:6379');
} catch (e) {
  console.warn('Redis unavailable, rate limiting disabled');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
});

const auditPool = new Pool({
  connectionString: process.env.AUDIT_DATABASE_URL || process.env.DATABASE_URL,
  max: 10,
});

module.exports = { pool, auditPool, redisClient };
