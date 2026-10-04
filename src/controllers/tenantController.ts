import { Request, Response } from 'express';
import { AuditService } from '../services/auditService';
import { Tenant } from '../models/Tenant';

export const createTenant = async (req: Request, res: Response) => {
    try {
        const tenant = new Tenant(req.body);
        await tenant.save();

        await AuditService.log('CREATE_TENANT', { tenantId: tenant._id }, req.user?._id, tenant._id.toString());

        res.status(201).json(tenant);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao criar tenant' });
    }
};

export const updateTenant = async (req: Request, res: Response) => {
    try {
        const tenant = await Tenant.findById(req.params.id);
        if (!tenant) {
            return res.status(404).json({ error: 'Tenant não encontrado' });
        }

        Object.assign(tenant, req.body);
        await tenant.save();

        await AuditService.log('UPDATE_TENANT', { tenantId: tenant._id }, req.user?._id, tenant._id.toString());

        res.json(tenant);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao atualizar tenant' });
    }
};

export const deleteTenant = async (req: Request, res: Response) => {
    try {
        const tenant = await Tenant.findById(req.params.id);
        if (!tenant) {
            return res.status(404).json({ error: 'Tenant não encontrado' });
        }

        await tenant.deleteOne();

        await AuditService.log('DELETE_TENANT', { tenantId: tenant._id }, req.user?._id, tenant._id.toString());

        res.json({ message: 'Tenant deletado com sucesso' });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao deletar tenant' });
    }
};
