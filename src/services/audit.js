const { auditPool } = require('../config/database');

class AuditService {
  constructor() {
    this.buffer = [];
    this.flushInterval = setInterval(() => this.flush(), 5000);
  }

  async record(action, details = {}, userId = null, tenantId = null) {
    const entry = {
      action,
      details: JSON.stringify(details),
      userId,
      tenantId,
      ipAddress: null,
      userAgent: null,
      timestamp: new Date().toISOString(),
      requestId: null
    };

    this.buffer.push(entry);

    if (this.buffer.length >= 50) {
      await this.flush();
    }
  }

  async flush() {
    if (this.buffer.length === 0) return;

    const entries = this.buffer.splice(0);
    try {
      const values = entries.map(e => [
        e.action, e.details, e.userId, e.tenantId,
        e.ipAddress, e.userAgent, e.timestamp, e.requestId
      ]);

      const query = `
        INSERT INTO audit_logs (action, details, user_id, tenant_id, ip_address, user_agent, timestamp, request_id)
        VALUES ${values.map((_, i) => `($${i * 8 + 1}, $${i * 8 + 2}, $${i * 8 + 3}, $${i * 8 + 4}, $${i * 8 + 5}, $${i * 8 + 6}, $${i * 8 + 7}, $${i * 8 + 8})`).join(', ')}
        RETURNING id
      `;

      await auditPool.query(query, values.flat());
    } catch (err) {
      console.error('Audit flush failed:', err);
      this.buffer.unshift(...entries);
    }
  }

  async getLogs(filters = {}) {
    const conditions = [];
    const params = [];

    if (filters.action) {
      conditions.push(`action ILIKE $${params.length + 1}`);
      params.push(`%${filters.action}%`);
    }
    if (filters.userId) {
      conditions.push(`user_id = $${params.length + 1}`);
      params.push(filters.userId);
    }
    if (filters.tenantId) {
      conditions.push(`tenant_id = $${params.length + 1}`);
      params.push(filters.tenantId);
    }
    if (filters.startDate) {
      conditions.push(`timestamp >= $${params.length + 1}`);
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      conditions.push(`timestamp <= $${params.length + 1}`);
      params.push(filters.endDate);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const query = `SELECT * FROM audit_logs ${whereClause} ORDER BY timestamp DESC LIMIT 100`;
    return auditPool.query(query, params);
  }

  shutdown() {
    clearInterval(this.flushInterval);
    return this.flush();
  }
}

module.exports = new AuditService();
