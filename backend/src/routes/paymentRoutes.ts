import { Router } from 'express';
import { PaymentController } from '../controllers/paymentController.js';
import { require2FA } from '../middlewares/require2fa.js';
import { authenticateJWT } from '../middlewares/auth.js';
import { isolateOrganization } from '../middlewares/rbac.js';
import { syncTenantFromUser } from '../middleware/tenantContext.js';
import {
  strictTenantBoundary,
  validateActiveTenant,
  logTenantAccess,
} from '../middleware/enhancedTenantIsolation.js';
import { isFeatureEnabled } from '../config/env.js';

const router = Router();

router.use(authenticateJWT);

if (isFeatureEnabled('TENANT_ISOLATION_STRICT_MODE')) {
  router.use(syncTenantFromUser);
  router.use(strictTenantBoundary);
  router.use(validateActiveTenant);
  router.use(logTenantAccess);
}

router.get('/anchor-info', PaymentController.getAnchorInfo);
router.post('/sep31/initiate', isolateOrganization, require2FA, PaymentController.initiateSEP31);
router.get('/sep31/status/:domain/:id', PaymentController.getStatus);
router.get('/paths', PaymentController.getCrossAssetPaths);

export default router;
