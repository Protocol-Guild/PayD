const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const { globalLimiter, authLimiter, apiLimiter } = require('./middleware/rateLimiting');
const auditing = require('./middleware/auditing');
const { tenantIsolation } = require('./middleware/tenantIsolation');

const app = express();

// Security middleware
app.use(helmet());
app.use(cors());

// Rate limiting
app.use(globalLimiter);

// Auditing
app.use(auditing);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Tenant isolation for API routes
app.use('/api/', tenantIsolation);

// Routes
app.use('/api/auth', authLimiter, require('./routes/auth'));
app.use('/api/tenants', apiLimiter, require('./routes/tenants'));
app.use('/api/users', apiLimiter, require('./routes/users'));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

module.exports = app;
