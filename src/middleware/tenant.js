// Middleware de isolamento multitenant
const tenantMiddleware = (req, res, next) => {
  // Extrair tenant ID do header ou do token de autenticação
  const tenantId = req.headers['x-tenant-id'] || (req.user && req.user.tenantId);

  if (!tenantId) {
    return res.status(400).json({ error: 'Tenant ID não fornecido' });
  }

  // Adicionar tenant ID ao request para uso posterior
  req.tenantId = tenantId;

  // Interceptar consultas ao banco de dados para aplicar isolamento
  // Isso é uma simplificação; em uma aplicação real, precisaria de uma solução mais robusta
  const originalQuery = req.query;
  req.query = new Proxy(originalQuery, {
    get: (target, prop) => {
      if (prop === 'tenantId') {
        return tenantId;
      }
      return target[prop];
    }
  });

  next();
};

module.exports = tenantMiddleware;
