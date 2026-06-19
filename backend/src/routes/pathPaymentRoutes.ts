import { Router } from 'express';
import { pathPaymentController } from '../controllers/pathPaymentController.js';
import { authenticateToken } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/rbac.js';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// ── ORGANIZATION CONFIGURATION ────────────────────────────────────────

/**
 * POST /api/v1/path-payments/configure
 * Configure organization for path payment payrolls
 * Requires: admin or finance_manager role
 */
router.post(
  '/configure',
  requireRole(['admin', 'finance_manager']),
  pathPaymentController.configureOrganization
);

/**
 * GET /api/v1/path-payments/config
 * Get organization path payment configuration
 * Requires: admin, finance_manager, or finance_viewer role
 */
router.get(
  '/config',
  requireRole(['admin', 'finance_manager', 'finance_viewer']),
  pathPaymentController.getOrganizationConfig
);

// ── PAYROLL EXECUTION ──────────────────────────────────────────────────

/**
 * POST /api/v1/path-payments/payroll/execute
 * Execute payroll using path payments
 * Requires: admin or finance_manager role
 */
router.post(
  '/payroll/execute',
  requireRole(['admin', 'finance_manager']),
  pathPaymentController.executePayrollRun
);

/**
 * POST /api/v1/path-payments/payroll/estimate
 * Estimate payroll costs with path payment conversion
 * Requires: admin, finance_manager, or finance_viewer role
 */
router.post(
  '/payroll/estimate',
  requireRole(['admin', 'finance_manager', 'finance_viewer']),
  pathPaymentController.estimatePayrollCosts
);

/**
 * GET /api/v1/path-payments/payroll/runs/:runId
 * Get payroll run status and details
 * Requires: admin, finance_manager, or finance_viewer role
 */
router.get(
  '/payroll/runs/:runId',
  requireRole(['admin', 'finance_manager', 'finance_viewer']),
  pathPaymentController.getPayrollRunStatus
);

/**
 * GET /api/v1/path-payments/payroll/runs
 * Get organization payroll runs history
 * Requires: admin, finance_manager, or finance_viewer role
 */
router.get(
  '/payroll/runs',
  requireRole(['admin', 'finance_manager', 'finance_viewer']),
  pathPaymentController.getPayrollRunsHistory
);

// ── PATH DISCOVERY ─────────────────────────────────────────────────────

/**
 * POST /api/v1/path-payments/paths/find
 * Find optimal paths for asset conversion
 * Requires: authenticated user
 */
router.post(
  '/paths/find',
  pathPaymentController.findOptimalPaths
);

/**
 * GET /api/v1/path-payments/assets
 * Get supported assets for path payments
 * Requires: authenticated user
 */
router.get(
  '/assets',
  pathPaymentController.getSupportedAssets
);

/**
 * GET /api/v1/path-payments/liquidity/stats
 * Get liquidity pool statistics
 * Requires: authenticated user
 */
router.get(
  '/liquidity/stats',
  pathPaymentController.getLiquidityPoolStats
);

export default router;