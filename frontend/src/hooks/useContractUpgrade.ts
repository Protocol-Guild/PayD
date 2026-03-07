/**
 * useContractUpgrade Hook
 *
 * Provides state management and operations for contract upgrades and migrations.
 * Handles WASM validation, upgrade simulation, execution, and migration tracking.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  getContracts,
  getContractDetails,
  validateWasmHash,
  simulateUpgrade,
  executeUpgrade,
  getUpgradeDiff,
  startMigration,
  getMigrationStatus,
  getContractMigrations,
  isMigrationRequired,
  type ContractInfo,
  type WasmValidationResult,
  type UpgradeSimulationResult,
  type UpgradeExecutionResult,
  type UpgradeDiffResult,
  type MigrationStatus,
} from '../services/contractUpgrade';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface UseContractUpgradeState {
  contracts: ContractInfo[];
  selectedContract: ContractInfo | null;
  loading: boolean;
  error: string | null;
}

interface UseContractUpgradeActions {
  // Data loading
  loadContracts: (network?: string) => Promise<void>;
  selectContract: (contractId: string) => Promise<void>;
  refreshContractDetails: () => Promise<void>;

  // WASM validation
  validateWasm: (wasmHash: string) => Promise<WasmValidationResult>;

  // Upgrade operations
  simulateUpgrade: (newWasmHash: string, network: string, adminSecret?: string) => Promise<UpgradeSimulationResult | null>;
  executeUpgrade: (newWasmHash: string, network: string, adminSecret: string) => Promise<UpgradeExecutionResult | null>;
  getUpgradeDiff: (newWasmHash: string) => Promise<UpgradeDiffResult | null>;

  // Migration operations
  startMigration: (fromVersion: string, toVersion: string) => Promise<MigrationStatus | null>;
  pollMigrationStatus: (migrationId: string, onUpdate?: (status: MigrationStatus) => void) => () => void;
  loadMigrationHistory: () => Promise<MigrationStatus[]>;
  checkMigrationRequired: (fromVersion: string, toVersion: string) => Promise<boolean>;

  // State management
  clearError: () => void;
  resetState: () => void;
}

export type UseContractUpgradeReturn = UseContractUpgradeState & UseContractUpgradeActions;

// ----------------------------------------------------------------------------
// Hook
// ----------------------------------------------------------------------------

export function useContractUpgrade(): UseContractUpgradeReturn {
  // State
  const [contracts, setContracts] = useState<ContractInfo[]>([]);
  const [selectedContract, setSelectedContract] = useState<ContractInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs for managing intervals
  const pollingRef = useRef<Set<NodeJS.Timeout>>(new Set());

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      pollingRef.current.forEach((id) => clearInterval(id));
      pollingRef.current.clear();
    };
  }, []);

  // ----------------------------------------------------------------------------
  // Data Loading
  // ----------------------------------------------------------------------------

  const loadContracts = useCallback(async (network?: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getContracts(network);
      setContracts(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load contracts';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const selectContract = useCallback(async (contractId: string) => {
    setLoading(true);
    setError(null);
    try {
      const details = await getContractDetails(contractId);
      setSelectedContract(details);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load contract details';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshContractDetails = useCallback(async () => {
    if (!selectedContract) return;
    await selectContract(selectedContract.contractId);
  }, [selectedContract, selectContract]);

  // ----------------------------------------------------------------------------
  // WASM Validation
  // ----------------------------------------------------------------------------

  const validateWasm = useCallback(
    async (wasmHash: string): Promise<WasmValidationResult> => {
      if (!selectedContract) {
        return { valid: false, message: 'No contract selected' };
      }

      try {
        return await validateWasmHash(selectedContract.contractId, wasmHash, selectedContract.contractName);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Validation failed';
        return { valid: false, message };
      }
    },
    [selectedContract]
  );

  // ----------------------------------------------------------------------------
  // Upgrade Operations
  // ----------------------------------------------------------------------------

  const simulateUpgradeAction = useCallback(
    async (
      newWasmHash: string,
      network: string,
      adminSecret?: string
    ): Promise<UpgradeSimulationResult | null> => {
      if (!selectedContract) {
        setError('No contract selected');
        return null;
      }

      setLoading(true);
      setError(null);

      try {
        const result = await simulateUpgrade(
          selectedContract.contractId,
          newWasmHash,
          network,
          adminSecret
        );
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Simulation failed';
        setError(message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [selectedContract]
  );

  const executeUpgradeAction = useCallback(
    async (
      newWasmHash: string,
      network: string,
      adminSecret: string
    ): Promise<UpgradeExecutionResult | null> => {
      if (!selectedContract) {
        setError('No contract selected');
        return null;
      }

      setLoading(true);
      setError(null);

      try {
        const result = await executeUpgrade(
          selectedContract.contractId,
          newWasmHash,
          network,
          adminSecret
        );
        if (result.success) {
          // Refresh contract details after successful upgrade
          await refreshContractDetails();
        }
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Upgrade failed';
        setError(message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [selectedContract, refreshContractDetails]
  );

  const getUpgradeDiffAction = useCallback(
    async (newWasmHash: string): Promise<UpgradeDiffResult | null> => {
      if (!selectedContract) {
        setError('No contract selected');
        return null;
      }

      setLoading(true);
      setError(null);

      try {
        const result = await getUpgradeDiff(
          selectedContract.contractId,
          selectedContract.currentWasmHash,
          newWasmHash
        );
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to get upgrade diff';
        setError(message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [selectedContract]
  );

  // ----------------------------------------------------------------------------
  // Migration Operations
  // ----------------------------------------------------------------------------

  const startMigrationAction = useCallback(
    async (fromVersion: string, toVersion: string): Promise<MigrationStatus | null> => {
      if (!selectedContract) {
        setError('No contract selected');
        return null;
      }

      setLoading(true);
      setError(null);

      try {
        const status = await startMigration(selectedContract.contractId, fromVersion, toVersion);
        return status;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to start migration';
        setError(message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [selectedContract]
  );

  const pollMigrationStatus = useCallback(
    (migrationId: string, onUpdate?: (status: MigrationStatus) => void): (() => void) => {
      const poll = async () => {
        try {
          const status = await getMigrationStatus(migrationId);
          if (status && onUpdate) {
            onUpdate(status);
          }
          // Stop polling if migration is complete or failed
          if (status?.status === 'completed' || status?.status === 'failed') {
            stopPolling();
          }
        } catch (err) {
          console.error('Error polling migration status:', err);
        }
      };

      // Poll immediately
      poll();

      // Set up interval
      const intervalId = setInterval(poll, 2000);
      pollingRef.current.add(intervalId);

      const stopPolling = () => {
        clearInterval(intervalId);
        pollingRef.current.delete(intervalId);
      };

      return stopPolling;
    },
    []
  );

  const loadMigrationHistory = useCallback(async (): Promise<MigrationStatus[]> => {
    if (!selectedContract) {
      setError('No contract selected');
      return [];
    }

    try {
      return await getContractMigrations(selectedContract.contractId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load migration history';
      setError(message);
      return [];
    }
  }, [selectedContract]);

  const checkMigrationRequiredAction = useCallback(
    async (fromVersion: string, toVersion: string): Promise<boolean> => {
      if (!selectedContract) {
        setError('No contract selected');
        return false;
      }

      try {
        return await isMigrationRequired(selectedContract.contractId, fromVersion, toVersion);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to check migration requirement';
        setError(message);
        return false;
      }
    },
    [selectedContract]
  );

  // ----------------------------------------------------------------------------
  // State Management
  // ----------------------------------------------------------------------------

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const resetState = useCallback(() => {
    setContracts([]);
    setSelectedContract(null);
    setLoading(false);
    setError(null);
    pollingRef.current.forEach((id) => clearInterval(id));
    pollingRef.current.clear();
  }, []);

  return {
    // State
    contracts,
    selectedContract,
    loading,
    error,

    // Actions
    loadContracts,
    selectContract,
    refreshContractDetails,
    validateWasm,
    simulateUpgrade: simulateUpgradeAction,
    executeUpgrade: executeUpgradeAction,
    getUpgradeDiff: getUpgradeDiffAction,
    startMigration: startMigrationAction,
    pollMigrationStatus,
    loadMigrationHistory,
    checkMigrationRequired: checkMigrationRequiredAction,
    clearError,
    resetState,
  };
}
