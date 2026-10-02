const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const auditService = require('../services/audit');

const router = express.Router();

router.use(authenticate);
router.use(authorize('admin'));

router.get('/audit/logs', async (req, res) => {
  try {
    const filters = {
      action: req.query.action,
      userId: req.query.userId,
      tenantId: req.query.tenantId,
      startDate: req.query.startDate,
      endDate: req.query.endDate
    };

    const { rows } = await auditService.getLogs(filters);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

router.get('/audit/stats', async (req, res) => {
  try {
    const [total, byAction, byTenant] = await Promise.all([
      auditService.getLogs({}),
      auditService.getLogs({ group: 'action' }),
      auditService.getLogs({ group: 'tenant' })
    ]);

    res.json({
      total: total.rows.length,
      byAction: byAction.rows,
      byTenant: byTenant.rows
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch audit stats' });
  }
});

module.exports = router;
