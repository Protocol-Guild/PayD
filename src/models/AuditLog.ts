import { Schema, model, Document } from 'mongoose';

export interface IAuditLog extends Document {
    action: string;
    details: any;
    userId?: string;
    tenantId?: string;
    timestamp: Date;
}

const auditLogSchema = new Schema<IAuditLog>({
    action: { type: String, required: true },
    details: { type: Schema.Types.Mixed, required: true },
    userId: { type: String, required: false },
    tenantId: { type: String, required: false },
    timestamp: { type: Date, default: Date.now },
});

export const AuditLog = model<IAuditLog>('AuditLog', auditLogSchema);
