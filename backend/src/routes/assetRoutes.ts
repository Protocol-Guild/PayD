import { Router } from 'express';
import { AssetController } from '../controllers/assetController.js';
import { authenticateJWT } from '../middlewares/auth.js';
import { authorizeRoles } from '../middlewares/rbac.js';
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

router.use(authorizeRoles('EMPLOYER'));

router.post('/issue', AssetController.issueOrgUsd);
router.post('/clawback', AssetController.clawback);

export default router;
