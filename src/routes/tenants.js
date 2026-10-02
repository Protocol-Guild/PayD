const express = require('express');
const { pool } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { apiRateLimit } = require('../middleware/rateLimit');
const audit = require('../services/audit');

const router = express.Router();

router.use(authenticate);
router.use(authorize('admin'));
router.use(apiRateLimit);

router.get('/tenants', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, name, status, created_at FROM tenants ORDER BY created_at DESC'
    );
    await audit.record('list_tenants', {}, req.userId);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to list tenants' });
  }
});

router.post('/tenants', async (req, res) => {
  const { name, settings } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Tenant name is required' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO tenants (name, settings, created_by)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [name, JSON.stringify(settings || {}), req.userId]
    );

    await audit.record('create_tenant', {
      tenantId: result.rows[0].id,
      name
    }, req.userId);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    await audit.record('tenant_creation_failed', { error: err.message }, req.userId);
    res.status(500).json({ error: 'Failed to create tenant' });
  }
});

router.get('/tenants/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM tenants WHERE id = $1', [req.params.id]);

    if (!rows.length) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    await audit.record('view_tenant', { tenantId: req.params.id }, req.userId);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch tenant' });
  }
});

module.exports = router;
