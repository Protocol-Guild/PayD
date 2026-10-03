const { query } = require('../database/connection');

const tenantIsolation = (req, res, next) => {
  // Extract tenant ID from authenticated user or request headers
  const tenantId = req.user?.tenantId || req.headers['x-tenant-id'];
  
  if (!tenantId) {
    return res.status(400).json({
      error: 'Tenant ID required',
      message: 'Please provide a valid tenant identifier'
    });
  }

  // Store tenant context for use in subsequent middleware
  req.tenantContext = { tenantId };
  
  next();
};

// Helper function to add tenant filter to queries
const withTenantFilter = (queryBuilder, tenantId) => {
  return queryBuilder.where('tenant_id', tenantId);
};

module.exports = {
  tenantIsolation,
  withTenantFilter
};
