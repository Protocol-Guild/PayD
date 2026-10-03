const rateLimit = require('express-rate-limit');

// Rate limiting por IP para proteção contra abuso
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // limita cada IP a 100 requisições por windowMs
  message: 'Muitas requisições a partir deste IP, por favor tente novamente mais tarde.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting mais estrito para endpoints sensíveis
const sensitiveLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Muitas tentativas, por favor tente novamente mais tarde.',
});

module.exports = { apiLimiter, sensitiveLimiter };
