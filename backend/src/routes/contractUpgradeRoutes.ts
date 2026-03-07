/**
 * Contract Upgrade Routes
 *
 * API endpoints for Soroban contract upgrade and migration operations.
 */

import { Router } from 'express';
import { ContractUpgradeController } from '../controllers/contractUpgradeController.js';

const router = Router();

// Contract listing and details
router.get('/', ContractUpgradeController.getContracts);
router.get('/:contractId', ContractUpgradeController.getContractDetails);

// WASM validation
router.post('/:contractId/validate-wasm', ContractUpgradeController.validateWasm);

// Upgrade operations
router.post('/:contractId/simulate-upgrade', ContractUpgradeController.simulateUpgrade);
router.post('/:contractId/upgrade', ContractUpgradeController.executeUpgrade);
router.post('/:contractId/upgrade-diff', ContractUpgradeController.getUpgradeDiff);

// Migration operations
router.post('/:contractId/migrate', ContractUpgradeController.startMigration);
router.get('/:contractId/migrations', ContractUpgradeController.getContractMigrations);
router.get('/:contractId/migration-required', ContractUpgradeController.checkMigrationRequired);

// Migration status (separate route for convenience)
router.get('/migrations/:migrationId', ContractUpgradeController.getMigrationStatus);

export default router;
