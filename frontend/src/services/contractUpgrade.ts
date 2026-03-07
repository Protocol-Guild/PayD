/**
 * Contract Upgrade Service
 *
 * Frontend service for interacting with the contract upgrade API.
 * Handles WASM validation, upgrade simulation, and migration tracking.
 */

const API_BASE = '/api/v1/contracts';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface ContractInfo {
  contractId: string;
  contractName: string;
  currentWasmHash: string;
  network: string;
  deployedAt: string;
  version?: string;
}

export interface WasmValidationResult {
  valid: boolean;
  message: string;
  wasmHash?: string;
  codeLength?: number;
}

export interface UpgradeSimulationResult {
  success: boolean;
  message: string;
  estimatedFee?: string;
  error?: string;
  warnings?: string[];
}

export interface UpgradeExecutionResult {
  success: boolean;
  message: string;
  transactionHash?: string;
  ledgerSequence?: number;
  newWasmHash?: string;
  error?: string;
}

export interface UpgradeDiffResult {
  changes: string[];
  breaking: boolean;
  newFeatures: string[];
  deprecations: string[];
}

export interface MigrationStatus {
  id: string;
  contractId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  totalSteps: number;
  completedSteps: number;
  currentStep?: string;
  logs: string[];
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// ----------------------------------------------------------------------------
// API Functions
// ----------------------------------------------------------------------------

/**
 * Get all deployed contracts
 */
export async function getContracts(network?: string): Promise<ContractInfo[]> {
  const params = network ? `?network=${encodeURIComponent(network)}` : '';
  const response = await fetch(`${API_BASE}${params}`);
  const result: ApiResponse<ContractInfo[]> = await response.json();

  if (!result.success) {
    throw new Error(result.error || 'Failed to fetch contracts');
  }

  return result.data || [];
}

/**
 * Get details for a specific contract
 */
export async function getContractDetails(contractId: string): Promise<ContractInfo | null> {
  const response = await fetch(`${API_BASE}/${encodeURIComponent(contractId)}`);
  const result: ApiResponse<ContractInfo> = await response.json();

  if (!result.success) {
    if (response.status === 404) return null;
    throw new Error(result.error || 'Failed to fetch contract details');
  }

  return result.data || null;
}

/**
 * Validate a WASM hash format and check against registry
 */
export async function validateWasmHash(
  contractId: string,
  wasmHash: string,
  contractName?: string
): Promise<WasmValidationResult> {
  const response = await fetch(`${API_BASE}/${encodeURIComponent(contractId)}/validate-wasm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ wasmHash, contractName }),
  });

  const result: ApiResponse<WasmValidationResult> = await response.json();

  if (!result.success) {
    throw new Error(result.error || 'Validation failed');
  }

  return result.data!;
}

/**
 * Simulate a contract upgrade transaction
 */
export async function simulateUpgrade(
  contractId: string,
  newWasmHash: string,
  network: string,
  adminSecret?: string
): Promise<UpgradeSimulationResult> {
  const response = await fetch(`${API_BASE}/${encodeURIComponent(contractId)}/simulate-upgrade`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ newWasmHash, network, adminSecret }),
  });

  const result: ApiResponse<UpgradeSimulationResult> = await response.json();

  if (!result.success) {
    throw new Error(result.error || 'Simulation failed');
  }

  return result.data!;
}

/**
 * Execute a contract upgrade
 */
export async function executeUpgrade(
  contractId: string,
  newWasmHash: string,
  network: string,
  adminSecret: string
): Promise<UpgradeExecutionResult> {
  const response = await fetch(`${API_BASE}/${encodeURIComponent(contractId)}/upgrade`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ newWasmHash, network, adminSecret }),
  });

  const result: ApiResponse<UpgradeExecutionResult> = await response.json();

  if (!result.success) {
    throw new Error(result.error || 'Upgrade failed');
  }

  return result.data!;
}

/**
 * Get upgrade diff summary
 */
export async function getUpgradeDiff(
  contractId: string,
  currentWasmHash: string,
  newWasmHash: string
): Promise<UpgradeDiffResult> {
  const response = await fetch(`${API_BASE}/${encodeURIComponent(contractId)}/upgrade-diff`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentWasmHash, newWasmHash }),
  });

  const result: ApiResponse<UpgradeDiffResult> = await response.json();

  if (!result.success) {
    throw new Error(result.error || 'Failed to get upgrade diff');
  }

  return result.data!;
}

/**
 * Start a post-upgrade migration
 */
export async function startMigration(
  contractId: string,
  fromVersion: string,
  toVersion: string
): Promise<MigrationStatus> {
  const response = await fetch(`${API_BASE}/${encodeURIComponent(contractId)}/migrate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fromVersion, toVersion }),
  });

  const result: ApiResponse<MigrationStatus> = await response.json();

  if (!result.success) {
    throw new Error(result.error || 'Failed to start migration');
  }

  return result.data!;
}

/**
 * Get migration status by ID
 */
export async function getMigrationStatus(migrationId: string): Promise<MigrationStatus | null> {
  const response = await fetch(`${API_BASE}/migrations/${encodeURIComponent(migrationId)}`);
  const result: ApiResponse<MigrationStatus> = await response.json();

  if (!result.success) {
    if (response.status === 404) return null;
    throw new Error(result.error || 'Failed to fetch migration status');
  }

  return result.data || null;
}

/**
 * Get all migrations for a contract
 */
export async function getContractMigrations(contractId: string): Promise<MigrationStatus[]> {
  const response = await fetch(`${API_BASE}/${encodeURIComponent(contractId)}/migrations`);
  const result: ApiResponse<MigrationStatus[]> = await response.json();

  if (!result.success) {
    throw new Error(result.error || 'Failed to fetch migrations');
  }

  return result.data || [];
}

/**
 * Check if migration is required between versions
 */
export async function isMigrationRequired(
  contractId: string,
  fromVersion: string,
  toVersion: string
): Promise<boolean> {
  const params = new URLSearchParams({ fromVersion, toVersion });
  const response = await fetch(
    `${API_BASE}/${encodeURIComponent(contractId)}/migration-required?${params}`
  );
  const result: ApiResponse<{ required: boolean; contractId: string }> = await response.json();

  if (!result.success) {
    throw new Error(result.error || 'Failed to check migration requirement');
  }

  return result.data?.required ?? false;
}

// ----------------------------------------------------------------------------
// Utility Functions
// ----------------------------------------------------------------------------

/**
 * Format a WASM hash for display (truncated)
 */
export function formatWasmHash(hash: string, maxLength: number = 16): string {
  if (hash.length <= maxLength * 2) return hash;
  const half = Math.floor(maxLength / 2);
  return `${hash.slice(0, half)}...${hash.slice(-half)}`;
}

/**
 * Validate WASM hash format locally
 */
export function isValidWasmHashFormat(hash: string): boolean {
  const WASM_HASH_REGEX = /^[a-fA-F0-9]{64}$/;
  return WASM_HASH_REGEX.test(hash.trim());
}

/**
 * Format a Stellar contract ID for display
 */
export function formatContractId(contractId: string, maxLength: number = 12): string {
  if (contractId.length <= maxLength * 2 + 3) return contractId;
  const half = Math.floor(maxLength / 2);
  return `${contractId.slice(0, half)}...${contractId.slice(-half)}`;
}
