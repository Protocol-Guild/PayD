const auditLogger = require('../services/auditLogger');

// Middleware de auditoria para registrar ações importantes
const auditMiddleware = async (req, res, next) => {
  // Capturar o método original de envio de resposta
  const originalSend = res.send;
  let responseBody = '';

  res.send = function (data) {
    responseBody = data;
    return originalSend.apply(res, arguments);
  };

  // Após a resposta ser enviada
  res.on('finish', async () => {
    const logData = {
      timestamp: new Date().toISOString(),
      ip: req.ip,
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      user: req.user ? req.user.id : 'anonymous',
      responseBody: typeof responseBody === 'string' ? responseBody.substring(0, 500) : JSON.stringify(responseBody).substring(0, 500),
    };

    try {
      await auditLogger.log(logData);
    } catch (error) {
      console.error('Falha ao registrar auditoria:', error);
    }
  });

  next();
};

module.exports = auditMiddleware;
