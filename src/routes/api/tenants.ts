import { Router, Request, Response } from 'express';
import { rateLimit } from '../../middleware/rate-limit';
import { requireTenant, tenantMiddleware } from '../../middleware/multi-tenant';
import { getAuditLogger } from '../../services/audit.service';
import { getTenantFromDatabase, createTenant, updateTenant } from '../../services/tenant.service';
import { getTenantId } from '../../utils/tenant-context';

const router = Router();

router.use(requireTenant);
router.use(rateLimit({ points: 30, duration: 60, keyPrefix: 'rl:tenants' }));

router.get('/', async (req: Request, res: Response): Promise<void> => {
  const tenantId = getTenantId(req);
  const auditLogger = getAuditLogger();

  try {
    const tenant = await getTenantFromDatabase(tenantId);
    if (!tenant) {
      res.status(404).json({ error: 'Tenant not found' });
      return;
    }

    auditLogger.info('Tenant list accessed', {
      tenantId,
      action: 'GET /api/v1/tenants',
      entityType: 'tenant',
    });

    res.json({ tenant });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', tenantMiddleware, async (req: Request, res: Response): Promise<void> => {
  const auditLogger = getAuditLogger();
  const { slug, name, plan, settings } = req.body;

  try {
    const tenant = await createTenant({ slug, name, plan, settings });

    auditLogger.info('Tenant created', {
      action: 'POST /api/v1/tenants',
      entityType: 'tenant',
      entityId: tenant.id,
      newState: { slug: tenant.slug },
    });

    res.status(201).json({ tenant });
  } catch (error) {
    res.status(400).json({ error: String(error) });
  }
});

router.put('/:id', tenantMiddleware, async (req: Request, res: Response): Promise<void> => {
  const auditLogger = getAuditLogger();
  const { id } = req.params;
  const updates = req.body;

  try {
    const tenant = await updateTenant(id, updates);

    auditLogger.info('Tenant updated', {
      action: 'PUT /api/v1/tenants/:id',
      entityType: 'tenant',
      entityId: id,
      previousState: { plan: updates.plan ? 'unchanged' : undefined },
      newState: updates,
    });

    res.json({ tenant });
  } catch (error) {
    res.status(400).json({ error: String(error) });
  }
});

export default router;
