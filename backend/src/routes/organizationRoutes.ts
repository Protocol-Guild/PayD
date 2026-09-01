import { Router, Request, Response } from 'express';
import { pool } from '../config/database.js';
import { authenticateJWT } from '../middlewares/auth.js';
import { authorizeRoles, isolateOrganization } from '../middlewares/rbac.js';
import logger from '../utils/logger.js';

const router = Router();

router.use(authenticateJWT);
router.use(isolateOrganization);

const getOrganizationId = (req: Request): number | null =>
  req.user?.organizationId ?? req.tenantId ?? null;

const serializeOrgProfile = (row: any) => ({
  id: row.id,
  name: row.name,
  publicKey: row.public_key ?? null,
  contactEmail: row.contact_email ?? null,
  contactPhone: row.contact_phone ?? null,
  isActive: row.is_active ?? true,
  subscriptionTier: row.subscription_tier ?? 'free',
  createdAt: row.created_at ?? null,
  updatedAt: row.updated_at ?? null,
});

/**
 * GET /api/v1/organizations/profile
 * Return the calling organization's profile.
 */
router.get(
  '/profile',
  authorizeRoles('EMPLOYER', 'ADMIN'),
  async (req: Request, res: Response) => {
    const organizationId = getOrganizationId(req);
    if (!organizationId) {
      return res.status(400).json({ error: 'Organization context required' });
    }

    try {
      const result = await pool.query(
        `SELECT id, name, public_key, contact_email, contact_phone, is_active, subscription_tier, created_at, updated_at
           FROM organizations
          WHERE id = $1`,
        [organizationId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Organization not found' });
      }

      res.json({ organization: serializeOrgProfile(result.rows[0]) });
    } catch (err: any) {
      logger.error('Failed to fetch organization profile', { err, organizationId });
      res.status(500).json({ error: 'Failed to fetch organization profile' });
    }
  }
);

/**
 * PUT /api/v1/organizations/profile
 * Update the calling organization's editable profile fields.
 */
router.put(
  '/profile',
  authorizeRoles('EMPLOYER', 'ADMIN'),
  async (req: Request, res: Response) => {
    const organizationId = getOrganizationId(req);
    if (!organizationId) {
      return res.status(400).json({ error: 'Organization context required' });
    }

    const { name, contactEmail, contactPhone } = req.body ?? {};

    if (name !== undefined && (typeof name !== 'string' || name.trim().length === 0)) {
      return res.status(400).json({ error: 'Organization name must be a non-empty string' });
    }
    if (contactEmail !== undefined && typeof contactEmail !== 'string') {
      return res.status(400).json({ error: 'Contact email must be a string' });
    }
    if (contactPhone !== undefined && typeof contactPhone !== 'string') {
      return res.status(400).json({ error: 'Contact phone must be a string' });
    }

    try {
      const result = await pool.query(
        `UPDATE organizations
            SET name = COALESCE($2, name),
                contact_email = COALESCE($3, contact_email),
                contact_phone = COALESCE($4, contact_phone),
                updated_at = CURRENT_TIMESTAMP
          WHERE id = $1
          RETURNING id, name, public_key, contact_email, contact_phone, is_active, subscription_tier, created_at, updated_at`,
        [
          organizationId,
          name !== undefined ? name.trim() : null,
          contactEmail !== undefined ? contactEmail.trim() || null : null,
          contactPhone !== undefined ? contactPhone.trim() || null : null,
        ]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Organization not found' });
      }

      res.json({ organization: serializeOrgProfile(result.rows[0]) });
    } catch (err: any) {
      logger.error('Failed to update organization profile', { err, organizationId });
      res.status(500).json({ error: 'Failed to update organization profile' });
    }
  }
);

export default router;
