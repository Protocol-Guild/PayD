const AuditLog = require('../models/AuditLog');
const { v4: uuidv4 } = require('uuid');

const auditing = async (req, res, next) => {
  const startTime = Date.now();
  const originalSend = res.send;
  
  // Override res.send to capture response
  res.send = function(data) {
    const duration = Date.now() - startTime;
    
    // Create audit log entry
    const auditEntry = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      statusCode: res.statusCode,
      duration,
      body: JSON.stringify(req.body),
      query: JSON.stringify(req.query),
      params: JSON.stringify(req.params),
      user: req.user ? req.user.id : null,
      tenantId: req.tenantContext?.tenantId || null
    };

    // Save audit log asynchronously (don't block response)
    AuditLog.create(auditEntry).catch(err => {
      console.error('Audit log creation failed:', err);
    });

    return originalSend.call(this, data);
  };

  next();
};

module.exports = auditing;
