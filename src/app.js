const express = require('express');
const { apiLimiter, sensitiveLimiter } = require('./middleware/rateLimit');
const auditMiddleware = require('./middleware/audit');
const tenantMiddleware = require('./middleware/tenant');

const app = express();

// Middlewares
app.use(express.json());
app.use(auditMiddleware);
app.use(apiLimiter);

// Aplicar rate limiting sensível a endpoints específicos
app.use('/api/auth', sensitiveLimiter);
app.use('/api/payments', sensitiveLimiter);

// Middleware de tenant (deve vir após a autenticação para ter req.user)
app.use(tenantMiddleware);

// Rotas
app.use('/api/auth', require('./routes/auth'));
app.use('/api/payments', require('./routes/payments'));
// ... outras rotas

// Tratamento de erros
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Algo deu errado!' });
});

module.exports = app;
