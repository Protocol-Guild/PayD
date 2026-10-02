const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const { redisClient } = require('./config/database');
const audit = require('./services/audit');

const paymentRoutes = require('./routes/payments');
const tenantRoutes = require('./routes/tenants');
const auditRoutes = require('./routes/audit');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors());
app.use(express.json());

app.use('/api/payments', paymentRoutes);
app.use('/api/tenants', tenantRoutes);
app.use('/api/audit', auditRoutes);

app.get('/health', async (req, res) => {
  try {
    const dbHealthy = redisClient ? await redisClient.ping() : true;
    res.json({ status: 'ok', timestamp: new Date().toISOString(), redis: dbHealthy });
  } catch (err) {
    res.status(503).json({ status: 'error', message: err.message });
  }
});

process.on('SIGTERM', () => {
  audit.shutdown();
  if (redisClient) redisClient.quit();
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
