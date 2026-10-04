import { Router } from 'express';
import { rateLimiter, strictRateLimiter } from '../middleware/rateLimiter';
import { tenantIsolation } from '../middleware/tenantIsolation';
import { createTenant, updateTenant, deleteTenant } from '../controllers/tenantController';

const router = Router();

router.post('/', strictRateLimiter, createTenant);
router.put('/:id', rateLimiter, tenantIsolation, updateTenant);
router.delete('/:id', rateLimiter, tenantIsolation, deleteTenant);

export default router;
