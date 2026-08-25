import { Router, Request, Response } from 'express';
import { insightCardsService } from '../services/insightCardsService.js';
import { InsightCardsQuerySchema } from '../schemas/insightCardsSchema.js';
import { authenticateJWT } from '../middlewares/auth.js';
import { isolateOrganization, authorizeRoles } from '../middlewares/rbac.js';
import logger from '../utils/logger.js';

const router = Router();

router.use(authenticateJWT);
router.use(isolateOrganization);

router.get('/', authorizeRoles('EMPLOYER'), async (req: Request, res: Response) => {
  try {
    const parsed = InsightCardsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.flatten() });
      return;
    }

    const organizationId = req.user!.organizationId;
    const result = await insightCardsService.generate(organizationId, parsed.data.windowDays);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Failed to generate insight cards', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
