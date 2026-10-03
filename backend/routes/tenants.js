const express = require('express');
const router = express.Router();
const TenantService = require('../services/TenantService');
const { tenantValidation, validate } = require('../middleware/validation');
const { tenantIsolation } = require('../middleware/tenantIsolation');

// Initialize service with models
const Tenant = require('../models/Tenant');
const User = require('../models/User');
const tenantService = new TenantService(Tenant, User);

// Get all tenants (admin only)
router.get('/', async (req, res, next) => {
  try {
    const tenants = await Tenant.query();
    res.json(tenants);
  } catch (error) {
    next(error);
  }
});

// Get tenant by ID
router.get('/:id', tenantIsolation, async (req, res, next) => {
  try {
    const tenant = await tenantService.getTenantById(req.tenantContext.tenantId);
    res.json(tenant);
  } catch (error) {
    next(error);
  }
});

// Create new tenant
router.post('/', tenantValidation, validate, async (req, res, next) => {
  try {
    const tenant = await tenantService.createTenant(req.body);
    res.status(201).json(tenant);
  } catch (error) {
    next(error);
  }
});

// Update tenant
router.put('/:id', tenantIsolation, tenantValidation, validate, async (req, res, next) => {
  try {
    const tenant = await tenantService.updateTenant(req.tenantContext.tenantId, req.body);
    res.json(tenant);
  } catch (error) {
    next(error);
  }
});

// Delete tenant
router.delete('/:id', tenantIsolation, async (req, res, next) => {
  try {
    await tenantService.deleteTenant(req.tenantContext.tenantId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// Get tenant users
router.get('/:id/users', tenantIsolation, async (req, res, next) => {
  try {
    const users = await tenantService.getTenantUsers(req.tenantContext.tenantId);
    res.json(users);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
