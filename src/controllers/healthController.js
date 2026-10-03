const { Pool } = require('pg');
const redis = require('redis');

// Configurações de conexão (devem vir do ambiente ou de um módulo de config)
const dbConfig = {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
};

const redisConfig = {
  url: process.env.REDIS_URL || 'redis://localhost:6379',
};

// Verifica conexão com PostgreSQL
const checkDatabase = async () => {
  const pool = new Pool(dbConfig);
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    return true;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  } finally {
    await pool.end();
  }
};

// Verifica conexão com Redis
const checkRedis = async () => {
  const client = redis.createClient({ url: redisConfig.url });
  try {
    await client.connect();
    await client.ping();
    return true;
  } catch (error) {
    console.error('Redis health check failed:', error);
    return false;
  } finally {
    await client.quit();
  }
};

// Endpoint /health
exports.health = (req, res) => {
  res.status(200).json({ status: 'ok' });
};

// Endpoint /ready
exports.ready = async (req, res) => {
  const [dbHealthy, redisHealthy] = await Promise.all([
    checkDatabase(),
    checkRedis(),
  ]);

  const isReady = dbHealthy && redisHealthy;
  res.status(isReady ? 200 : 503).json({
    status: isReady ? 'ready' : 'not ready',
    dependencies: {
      database: dbHealthy ? 'ok' : 'error',
      redis: redisHealthy ? 'ok' : 'error',
    },
  });
};
