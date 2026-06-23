import { Router } from 'express';
import { AssetController } from '../controllers/assetController.js';
import { authenticateJWT } from '../middlewares/auth.js';
import { authorizeRoles } from '../middlewares/rbac.js';

const router = Router();

router.use(authenticateJWT);
router.use(authorizeRoles('EMPLOYER', 'ADMIN'));

router.post('/issue', AssetController.issueOrgUsd);
router.post('/clawback', AssetController.clawback);
router.get('/clawback/logs', AssetController.getClawbackLogs);

export default router;

