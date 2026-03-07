/**
 * Contract Upgrade Controller
 *
 * Handles HTTP requests for contract upgrade operations including:
 * - Listing deployed contracts
 * - Validating WASM hashes
 * - Simulating upgrades
 * - Executing upgrades
 * - Migration status tracking
 */

import { Request, Response } from 'express';
import {
  ContractUpgradeService,
  MigrationService,
  type WasmValidationResult,
  type UpgradeSimulationResult,
  type UpgradeExecutionResult,
  type MigrationStatus,
} from '../services/contractUpgradeService.js';
import logger from '../utils/logger.js';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// ----------------------------------------------------------------------------
// Controller
// ----------------------------------------------------------------------------

export class ContractUpgradeController {
  /**
   * GET /api/v1/contracts
   * Returns all deployed contracts with their current WASM hashes
   */
  static async getContracts(req: Request, res: Response): Promise<void> {
    try {
      const { network } = req.query as { network?: string };

      const contracts = await ContractUpgradeService.getDeployedContracts(network);

      const response: ApiResponse<typeof contracts> = {
        success: true,
        data: contracts,
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error('Error in getContracts controller', error);

      const response: ApiResponse<never> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch contracts',
        message: 'Unable to retrieve deployed contracts',
      };

      res.status(500).json(response);
    }
  }

  /**
   * GET /api/v1/contracts/:contractId
   * Returns details for a specific contract
   */
  static async getContractDetails(req: Request, res: Response): Promise<void> {
    try {
      const { contractId } = req.params;

      const contract = await ContractUpgradeService.getContractDetails(contractId);

      if (!contract) {
        const response: ApiResponse<never> = {
          success: false,
          error: 'Contract not found',
          message: `No contract found with ID: ${contractId}`,
        };
        res.status(404).json(response);
        return;
      }

      const response: ApiResponse<typeof contract> = {
        success: true,
        data: contract,
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error('Error in getContractDetails controller', error);

      const response: ApiResponse<never> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch contract details',
        message: 'Unable to retrieve contract details',
      };

      res.status(500).json(response);
    }
  }

  /**
   * POST /api/v1/contracts/:contractId/validate-wasm
   * Validates a WASM hash format and registry status
   */
  static async validateWasm(req: Request, res: Response): Promise<void> {
    try {
      const { contractId } = req.params;
      const { wasmHash, contractName } = req.body as {
        wasmHash: string;
        contractName?: string;
      };

      if (!wasmHash) {
        const response: ApiResponse<never> = {
          success: false,
          error: 'Missing required field',
          message: 'wasmHash is required in request body',
        };
        res.status(400).json(response);
        return;
      }

      // First validate format
      const formatResult = ContractUpgradeService.validateWasmHash(wasmHash);
      if (!formatResult.valid) {
        const response: ApiResponse<WasmValidationResult> = {
          success: false,
          data: formatResult,
          error: formatResult.message,
        };
        res.status(400).json(response);
        return;
      }

      // Then validate against registry if contract name provided
      const registryResult = await ContractUpgradeService.validateWasmInRegistry(
        wasmHash,
        contractName || 'unknown'
      );

      const response: ApiResponse<WasmValidationResult> = {
        success: registryResult.valid,
        data: registryResult,
        message: registryResult.message,
      };

      res.status(registryResult.valid ? 200 : 400).json(response);
    } catch (error) {
      logger.error('Error in validateWasm controller', error);

      const response: ApiResponse<never> = {
        success: false,
        error: error instanceof Error ? error.message : 'Validation failed',
        message: 'Unable to validate WASM hash',
      };

      res.status(500).json(response);
    }
  }

  /**
   * POST /api/v1/contracts/:contractId/simulate-upgrade
   * Simulates a contract upgrade transaction
   */
  static async simulateUpgrade(req: Request, res: Response): Promise<void> {
    try {
      const { contractId } = req.params;
      const { newWasmHash, network, adminSecret } = req.body as {
        newWasmHash: string;
        network: string;
        adminSecret?: string;
      };

      if (!newWasmHash || !network) {
        const response: ApiResponse<never> = {
          success: false,
          error: 'Missing required fields',
          message: 'newWasmHash and network are required in request body',
        };
        res.status(400).json(response);
        return;
      }

      // Validate WASM hash format first
      const validation = ContractUpgradeService.validateWasmHash(newWasmHash);
      if (!validation.valid) {
        const response: ApiResponse<UpgradeSimulationResult> = {
          success: false,
          data: {
            success: false,
            message: validation.message,
          },
          error: validation.message,
        };
        res.status(400).json(response);
        return;
      }

      const result = await ContractUpgradeService.simulateUpgrade(
        contractId,
        newWasmHash,
        network,
        adminSecret
      );

      const response: ApiResponse<UpgradeSimulationResult> = {
        success: result.success,
        data: result,
        message: result.message,
      };

      res.status(result.success ? 200 : 400).json(response);
    } catch (error) {
      logger.error('Error in simulateUpgrade controller', error);

      const response: ApiResponse<never> = {
        success: false,
        error: error instanceof Error ? error.message : 'Simulation failed',
        message: 'Unable to simulate contract upgrade',
      };

      res.status(500).json(response);
    }
  }

  /**
   * POST /api/v1/contracts/:contractId/upgrade
   * Executes a contract upgrade
   */
  static async executeUpgrade(req: Request, res: Response): Promise<void> {
    try {
      const { contractId } = req.params;
      const { newWasmHash, network, adminSecret } = req.body as {
        newWasmHash: string;
        network: string;
        adminSecret: string;
      };

      if (!newWasmHash || !network || !adminSecret) {
        const response: ApiResponse<never> = {
          success: false,
          error: 'Missing required fields',
          message: 'newWasmHash, network, and adminSecret are required',
        };
        res.status(400).json(response);
        return;
      }

      const result = await ContractUpgradeService.executeUpgrade(
        contractId,
        newWasmHash,
        network,
        adminSecret
      );

      const response: ApiResponse<UpgradeExecutionResult> = {
        success: result.success,
        data: result,
        message: result.message,
      };

      res.status(result.success ? 200 : 400).json(response);
    } catch (error) {
      logger.error('Error in executeUpgrade controller', error);

      const response: ApiResponse<never> = {
        success: false,
        error: error instanceof Error ? error.message : 'Upgrade failed',
        message: 'Unable to execute contract upgrade',
      };

      res.status(500).json(response);
    }
  }

  /**
   * POST /api/v1/contracts/:contractId/upgrade-diff
   * Returns a diff summary for an upgrade
   */
  static async getUpgradeDiff(req: Request, res: Response): Promise<void> {
    try {
      const { contractId } = req.params;
      const { currentWasmHash, newWasmHash } = req.body as {
        currentWasmHash: string;
        newWasmHash: string;
      };

      if (!currentWasmHash || !newWasmHash) {
        const response: ApiResponse<never> = {
          success: false,
          error: 'Missing required fields',
          message: 'currentWasmHash and newWasmHash are required',
        };
        res.status(400).json(response);
        return;
      }

      const diff = await ContractUpgradeService.getUpgradeDiff(
        contractId,
        currentWasmHash,
        newWasmHash
      );

      const response: ApiResponse<typeof diff> = {
        success: true,
        data: diff,
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error('Error in getUpgradeDiff controller', error);

      const response: ApiResponse<never> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate diff',
        message: 'Unable to generate upgrade diff',
      };

      res.status(500).json(response);
    }
  }

  /**
   * POST /api/v1/contracts/:contractId/migrate
   * Starts a post-upgrade migration
   */
  static async startMigration(req: Request, res: Response): Promise<void> {
    try {
      const { contractId } = req.params;
      const { fromVersion, toVersion } = req.body as {
        fromVersion: string;
        toVersion: string;
      };

      if (!fromVersion || !toVersion) {
        const response: ApiResponse<never> = {
          success: false,
          error: 'Missing required fields',
          message: 'fromVersion and toVersion are required',
        };
        res.status(400).json(response);
        return;
      }

      const migration = await MigrationService.startMigration(contractId, fromVersion, toVersion);

      const response: ApiResponse<MigrationStatus> = {
        success: true,
        data: migration,
        message: 'Migration started successfully',
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error('Error in startMigration controller', error);

      const response: ApiResponse<never> = {
        success: false,
        error: error instanceof Error ? error.message : 'Migration failed to start',
        message: 'Unable to start migration',
      };

      res.status(500).json(response);
    }
  }

  /**
   * GET /api/v1/migrations/:migrationId
   * Returns the status of a migration
   */
  static async getMigrationStatus(req: Request, res: Response): Promise<void> {
    try {
      const { migrationId } = req.params;

      const status = await MigrationService.getMigrationStatus(migrationId);

      if (!status) {
        const response: ApiResponse<never> = {
          success: false,
          error: 'Migration not found',
          message: `No migration found with ID: ${migrationId}`,
        };
        res.status(404).json(response);
        return;
      }

      const response: ApiResponse<MigrationStatus> = {
        success: true,
        data: status,
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error('Error in getMigrationStatus controller', error);

      const response: ApiResponse<never> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch migration status',
        message: 'Unable to retrieve migration status',
      };

      res.status(500).json(response);
    }
  }

  /**
   * GET /api/v1/contracts/:contractId/migrations
   * Returns all migrations for a contract
   */
  static async getContractMigrations(req: Request, res: Response): Promise<void> {
    try {
      const { contractId } = req.params;

      const migrations = await MigrationService.getContractMigrations(contractId);

      const response: ApiResponse<typeof migrations> = {
        success: true,
        data: migrations,
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error('Error in getContractMigrations controller', error);

      const response: ApiResponse<never> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch migrations',
        message: 'Unable to retrieve contract migrations',
      };

      res.status(500).json(response);
    }
  }

  /**
   * GET /api/v1/contracts/:contractId/migration-required
   * Checks if migration is required between versions
   */
  static async checkMigrationRequired(req: Request, res: Response): Promise<void> {
    try {
      const { contractId } = req.params;
      const { fromVersion, toVersion } = req.query as {
        fromVersion: string;
        toVersion: string;
      };

      if (!fromVersion || !toVersion) {
        const response: ApiResponse<never> = {
          success: false,
          error: 'Missing required query parameters',
          message: 'fromVersion and toVersion query parameters are required',
        };
        res.status(400).json(response);
        return;
      }

      const required = await MigrationService.isMigrationRequired(fromVersion, toVersion);

      const response: ApiResponse<{ required: boolean; contractId: string }> = {
        success: true,
        data: {
          required,
          contractId,
        },
        message: required
          ? 'Data migration is required for this upgrade'
          : 'No data migration required',
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error('Error in checkMigrationRequired controller', error);

      const response: ApiResponse<never> = {
        success: false,
        error: error instanceof Error ? error.message : 'Check failed',
        message: 'Unable to check migration requirement',
      };

      res.status(500).json(response);
    }
  }
}
