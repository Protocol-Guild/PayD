const { pool } = require('../config/database');

const enforceTenant = async (req, res, next) => {
  const { tenantId } = req.params;
  const authenticatedTenantId = req.tenantId;

  if (!tenantId) {
    req.effectiveTenantId = authenticatedTenantId;
    return next();
  }

  if (req.role === 'admin') {
    req.effectiveTenantId = tenantId;
    return next();
  }

  if (tenantId !== authenticatedTenantId) {
    req.audit?.record('tenant_access_denied', {
      attemptedTenant: tenantId,
      userTenant: authenticatedTenantId
    });
    return res.status(403).json({ error: 'Tenant access denied' });
  }

  req.effectiveTenantId = tenantId;
  next();
};

const tenantQuery = (baseQuery) => {
  return (req, res, next) => {
    const query = baseQuery.replace(/__TENANT__/g, req.effectiveTenantId || req.tenantId);
    req.tenantQuery = query;
    next();
  };
};

module.exports = { enforceTenant, tenantQuery };
