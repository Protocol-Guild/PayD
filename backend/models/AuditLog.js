const { Model } = require('objection');
const {Knex} = require('knex');

class AuditLog extends Model {
  static get tableName() {
    return 'audit_logs';
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['timestamp', 'method', 'path', 'ip', 'statusCode'],
      properties: {
        id: { type: 'string', format: 'uuid' },
        timestamp: { type: 'string', format: 'date-time' },
        method: { type: 'string' },
        path: { type: 'string' },
        ip: { type: 'string' },
        userAgent: { type: 'string' },
        statusCode: { type: 'integer' },
        duration: { type: 'integer' },
        body: { type: 'string' },
        query: { type: 'string' },
        params: { type: 'string' },
        user: { type: 'string' },
        tenantId: { type: 'string' }
      }
    };
  }

  static get relationMappings() {
    const User = require('./User');
    const Tenant = require('./Tenant');

    return {
      user: {
        relation: Model.BelongsToOneRelation,
        modelClass: User,
        join: {
          from: 'audit_logs.user',
          to: 'users.id'
        }
      },
      tenant: {
        relation: Model.BelongsToOneRelation,
        modelClass: Tenant,
        join: {
          from: 'audit_logs.tenantId',
          to: 'tenants.id'
        }
      }
    };
  }
}

module.exports = AuditLog;
