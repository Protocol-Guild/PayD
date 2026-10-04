import { AuditLog, IAuditLog } from '../models/AuditLog';

export class AuditService {
    static async log(action: string, details: any, userId?: string, tenantId?: string): Promise<IAuditLog> {
        const auditLog = new AuditLog({
            action,
            details,
            userId,
            tenantId,
            timestamp: new Date(),
        });
        return await auditLog.save();
    }

    static async getAuditLogs(tenantId?: string, userId?: string, action?: string, startDate?: Date, endDate?: Date): Promise<IAuditLog[]> {
        const query: any = {};
        if (tenantId) query.tenantId = tenantId;
        if (userId) query.userId = userId;
        if (action) query.action = action;
        if (startDate || endDate) {
            query.timestamp = {};
            if (startDate) query.timestamp.$gte = startDate;
            if (endDate) query.timestamp.$lte = endDate;
        }
        return await AuditLog.find(query).sort({ timestamp: -1 });
    }
}
