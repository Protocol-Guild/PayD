import { Request, Response, NextFunction } from 'express';
import { Tenant } from '../models/Tenant';

export const tenantIsolation = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const tenantId = req.headers['x-tenant-id'] as string;
        if (!tenantId) {
            return res.status(400).json({ error: 'Tenant ID é obrigatório' });
        }

        const tenant = await Tenant.findById(tenantId);
        if (!tenant) {
            return res.status(404).json({ error: 'Tenant não encontrado' });
        }

        req.tenant = tenant;
        next();
    } catch (error) {
        res.status(500).json({ error: 'Erro ao isolar tenant' });
    }
};
