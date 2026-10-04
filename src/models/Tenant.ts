import { Schema, model, Document } from 'mongoose';

export interface ITenant extends Document {
    name: string;
    email: string;
    phone?: string;
    address?: string;
    createdAt: Date;
    updatedAt: Date;
}

const tenantSchema = new Schema<ITenant>({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String, required: false },
    address: { type: String, required: false },
}, {
    timestamps: true,
});

export const Tenant = model<ITenant>('Tenant', tenantSchema);
