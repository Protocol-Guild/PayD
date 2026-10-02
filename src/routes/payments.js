const express = require('express');
const { pool } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { apiRateLimit } = require('../middleware/rateLimit');
const { enforceTenant } = require('../middleware/tenant');
const audit = require('../services/audit');

const router = express.Router();

router.use(authenticate);
router.use(apiRateLimit);

router.get('/payments', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM payments WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 50',
      [req.effectiveTenantId || req.tenantId]
    );
    await audit.record('list_payments', { tenantId: req.effectiveTenantId }, req.userId);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to list payments' });
  }
});

router.post('/payments', async (req, res) => {
  const { amount, currency, recipient, description } = req.body;

  if (!amount || !currency || !recipient) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO payments (tenant_id, amount, currency, recipient, description, status, created_by)
       VALUES ($1, $2, $3, $4, $5, 'pending', $6)
       RETURNING *`,
      [req.effectiveTenantId, amount, currency, recipient, description, req.userId]
    );

    await audit.record('create_payment', {
      paymentId: result.rows[0].id,
      amount,
      recipient
    }, req.userId, req.effectiveTenantId);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    await audit.record('payment_creation_failed', { error: err.message }, req.userId, req.effectiveTenantId);
    res.status(500).json({ error: 'Failed to create payment' });
  }
});

router.get('/payments/:id', enforceTenant, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM payments WHERE id = $1 AND tenant_id = $2',
      [req.params.id, req.effectiveTenantId]
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    await audit.record('view_payment', { paymentId: req.params.id }, req.userId, req.effectiveTenantId);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch payment' });
  }
});

router.patch('/payments/:id/status', enforceTenant, async (req, res) => {
  const { status } = req.body;
  const validStatuses = ['pending', 'processing', 'completed', 'failed', 'cancelled'];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  try {
    const { rows } = await pool.query(
      `UPDATE payments
       SET status = $1, updated_at = NOW()
       WHERE id = $2 AND tenant_id = $3
       RETURNING *`,
      [status, req.params.id, req.effectiveTenantId]
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    await audit.record('update_payment_status', {
      paymentId: req.params.id,
      oldStatus: rows[0].status,
      newStatus: status
    }, req.userId, req.effectiveTenantId);

    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update payment status' });
  }
});

module.exports = router;
