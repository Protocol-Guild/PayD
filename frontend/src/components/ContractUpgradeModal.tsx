import { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  FileCode2,
  ArrowRightLeft,
  Shield,
  Loader2,
  X,
} from 'lucide-react';
import type {
  ContractInfo,
  UpgradeSimulationResult,
  UpgradeDiffResult,
  UpgradeExecutionResult,
} from '../../services/contractUpgrade';
import { formatWasmHash, formatContractId } from '../../services/contractUpgrade';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

type Step = 'input' | 'validation' | 'diff' | 'simulation' | 'confirm' | 'executing' | 'complete';

interface UpgradeConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  contract: ContractInfo | null;
  onExecute: (newWasmHash: string, network: string, adminSecret: string) => Promise<UpgradeExecutionResult | null>;
  onSimulate: (newWasmHash: string, network: string) => Promise<UpgradeSimulationResult | null>;
  onGetDiff: (newWasmHash: string) => Promise<UpgradeDiffResult | null>;
  onValidate: (wasmHash: string) => Promise<{ valid: boolean; message: string }>;
  isExecuting: boolean;
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function UpgradeConfirmationModal({
  isOpen,
  onClose,
  contract,
  onExecute,
  onSimulate,
  onGetDiff,
  onValidate,
  isExecuting,
}: UpgradeConfirmationModalProps) {
  const [step, setStep] = useState<Step>('input');
  const [newWasmHash, setNewWasmHash] = useState('');
  const [network, setNetwork] = useState('testnet');
  const [adminSecret, setAdminSecret] = useState('');
  const [validationResult, setValidationResult] = useState<{ valid: boolean; message: string } | null>(null);
  const [diffResult, setDiffResult] = useState<UpgradeDiffResult | null>(null);
  const [simulationResult, setSimulationResult] = useState<UpgradeSimulationResult | null>(null);
  const [executionResult, setExecutionResult] = useState<UpgradeExecutionResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep('input');
      setNewWasmHash('');
      setNetwork('testnet');
      setAdminSecret('');
      setValidationResult(null);
      setDiffResult(null);
      setSimulationResult(null);
      setExecutionResult(null);
      setIsLoading(false);
      setError(null);
    }
  }, [isOpen]);

  // ----------------------------------------------------------------------------
  // Step Handlers
  // ----------------------------------------------------------------------------

  const handleValidate = async () => {
    if (!newWasmHash.trim()) {
      setError('Please enter a WASM hash');
      return;
    }

    setIsLoading(true);
    setError(null);

    const result = await onValidate(newWasmHash);
    setValidationResult(result);

    if (result.valid) {
      setStep('diff');
      // Fetch diff after validation
      const diff = await onGetDiff(newWasmHash);
      if (diff) {
        setDiffResult(diff);
      }
    } else {
      setError(result.message);
    }

    setIsLoading(false);
  };

  const handleSimulate = async () => {
    setIsLoading(true);
    setError(null);
    setStep('simulation');

    const result = await onSimulate(newWasmHash, network);
    if (result) {
      setSimulationResult(result);
      if (result.success) {
        setStep('confirm');
      } else {
        setError(result.error || 'Simulation failed');
      }
    } else {
      setError('Simulation returned no result');
    }

    setIsLoading(false);
  };

  const handleExecute = async () => {
    if (!adminSecret.trim()) {
      setError('Admin secret is required for execution');
      return;
    }

    setStep('executing');
    setError(null);

    const result = await onExecute(newWasmHash, network, adminSecret);

    if (result) {
      setExecutionResult(result);
      setStep(result.success ? 'complete' : 'confirm');
      if (!result.success) {
        setError(result.error || 'Upgrade execution failed');
      }
    } else {
      setStep('confirm');
      setError('Execution returned no result');
    }
  };

  const handleNext = useCallback(() => {
    switch (step) {
      case 'input':
        handleValidate();
        break;
      case 'diff':
        handleSimulate();
        break;
      case 'simulation':
        setStep('confirm');
        break;
      case 'confirm':
        handleExecute();
        break;
      default:
        break;
    }
  }, [step, newWasmHash, network, adminSecret, handleValidate, handleSimulate, handleExecute]);

  const handleBack = () => {
    switch (step) {
      case 'diff':
        setStep('input');
        break;
      case 'simulation':
        setStep('diff');
        break;
      case 'confirm':
        setStep('diff');
        break;
      default:
        break;
    }
  };

  // ----------------------------------------------------------------------------
  // Render Helpers
  // ----------------------------------------------------------------------------

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center gap-2 mb-6">
      {[
        { id: 'input', label: 'Input' },
        { id: 'diff', label: 'Review' },
        { id: 'simulation', label: 'Simulate' },
        { id: 'confirm', label: 'Confirm' },
      ].map((s, i, arr) => (
        <div key={s.id} className="flex items-center">
          <div
            className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold ${
              step === s.id || (step === 'executing' && s.id === 'confirm')
                ? 'bg-accent text-white'
                : step === 'complete'
                  ? 'bg-emerald-500 text-white'
                  : ['input', 'diff', 'simulation', 'confirm', 'executing', 'complete'].indexOf(step) >
                      ['input', 'diff', 'simulation', 'confirm'].indexOf(s.id)
                    ? 'bg-emerald-500/50 text-white'
                    : 'bg-black/30 text-muted border border-hi'
            }`}
          >
            {step === 'complete' && s.id === 'confirm' ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              i + 1
            )}
          </div>
          <span className="ml-2 text-xs text-muted hidden sm:block">{s.label}</span>
          {i < arr.length - 1 && (
            <ChevronRight className="w-4 h-4 text-muted mx-2" />
          )}
        </div>
      ))}
    </div>
  );

  const renderInputStep = () => (
    <div className="space-y-4">
      <div className="bg-accent/10 border border-accent/30 p-4 rounded-xl">
        <h4 className="text-sm font-bold text-accent mb-2 flex items-center gap-2">
          <FileCode2 className="w-4 h-4" />
          Current Contract
        </h4>
        {contract && (
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted">Contract ID:</span>
              <span className="font-mono">{formatContractId(contract.contractId)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Current WASM:</span>
              <span className="font-mono">{formatWasmHash(contract.currentWasmHash)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Version:</span>
              <span>{contract.version || 'Unknown'}</span>
            </div>
          </div>
        )}
      </div>

      <div>
        <label className="block text-xs font-bold uppercase tracking-widest text-muted mb-2">
          Network
        </label>
        <select
          value={network}
          onChange={(e) => setNetwork(e.target.value)}
          className="w-full bg-black/20 border border-hi rounded-xl p-3 text-text outline-none focus:border-accent/50"
        >
          <option value="standalone">Standalone (Local)</option>
          <option value="testnet">Testnet</option>
          <option value="futurenet">Futurenet</option>
          <option value="public">Public (Mainnet)</option>
        </select>
      </div>

      <div>
        <label className="block text-xs font-bold uppercase tracking-widest text-muted mb-2">
          New WASM Hash (64 hex chars)
        </label>
        <input
          type="text"
          value={newWasmHash}
          onChange={(e) => setNewWasmHash(e.target.value.trim())}
          placeholder="a1b2c3d4..."
          className="w-full bg-black/20 border border-hi rounded-xl p-3 text-text font-mono outline-none focus:border-accent/50"
          maxLength={64}
          spellCheck={false}
        />
        <p className="text-xs text-muted mt-1">
          Enter the 64-character hexadecimal WASM hash to upgrade to
        </p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 p-3 rounded-xl text-red-400 text-sm flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          {error}
        </div>
      )}
    </div>
  );

  const renderDiffStep = () => (
    <div className="space-y-4">
      <div className="bg-accent/10 border border-accent/30 p-4 rounded-xl">
        <h4 className="text-sm font-bold text-accent mb-3 flex items-center gap-2">
          <ArrowRightLeft className="w-4 h-4" />
          Upgrade Summary
        </h4>

        <div className="space-y-3">
          <div className="flex items-center justify-between p-2 bg-black/20 rounded-lg">
            <div>
              <p className="text-xs text-muted">Current WASM</p>
              <p className="font-mono text-xs">{contract && formatWasmHash(contract.currentWasmHash)}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted" />
            <div className="text-right">
              <p className="text-xs text-muted">New WASM</p>
              <p className="font-mono text-xs text-accent">{formatWasmHash(newWasmHash)}</p>
            </div>
          </div>

          {diffResult && (
            <>
              {diffResult.breaking && (
                <div className="bg-red-500/10 border border-red-500/30 p-3 rounded-xl text-red-400 text-sm">
                  <AlertTriangle className="w-4 h-4 inline mr-2" />
                  <strong>Breaking Changes Detected</strong>
                </div>
              )}

              {diffResult.changes.length > 0 && (
                <div>
                  <p className="text-xs text-muted mb-2">Changes:</p>
                  <ul className="space-y-1">
                    {diffResult.changes.map((change, i) => (
                      <li key={i} className="text-sm flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                        {change}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {diffResult.newFeatures.length > 0 && (
                <div>
                  <p className="text-xs text-muted mb-2">New Features:</p>
                  <ul className="space-y-1">
                    {diffResult.newFeatures.map((feature, i) => (
                      <li key={i} className="text-sm flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center gap-2 text-sm text-muted">
          <Loader2 className="w-4 h-4 animate-spin" />
          Validating WASM hash...
        </div>
      )}
    </div>
  );

  const renderSimulationStep = () => (
    <div className="space-y-4">
      <div className="bg-accent/10 border border-accent/30 p-4 rounded-xl">
        <h4 className="text-sm font-bold text-accent mb-3 flex items-center gap-2">
          <Shield className="w-4 h-4" />
          Simulation Results
        </h4>

        {simulationResult ? (
          <div className="space-y-3">
            <div
              className={`p-3 rounded-xl ${
                simulationResult.success
                  ? 'bg-emerald-500/10 border border-emerald-500/30'
                  : 'bg-red-500/10 border border-red-500/30'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                {simulationResult.success ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                )}
                <span
                  className={`font-bold ${
                    simulationResult.success ? 'text-emerald-500' : 'text-red-500'
                  }`}
                >
                  {simulationResult.success ? 'Simulation Successful' : 'Simulation Failed'}
                </span>
              </div>
              <p className="text-sm text-muted">{simulationResult.message}</p>
            </div>

            {simulationResult.estimatedFee && (
              <div className="flex justify-between items-center p-2 bg-black/20 rounded-lg">
                <span className="text-sm text-muted">Estimated Fee:</span>
                <span className="font-mono text-sm">{simulationResult.estimatedFee}</span>
              </div>
            )}

            {simulationResult.warnings && simulationResult.warnings.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted">Warnings:</p>
                {simulationResult.warnings.map((warning, i) => (
                  <div
                    key={i}
                    className="bg-yellow-500/10 border border-yellow-500/30 p-2 rounded-lg text-sm text-yellow-400"
                  >
                    <AlertTriangle className="w-4 h-4 inline mr-2" />
                    {warning}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 text-sm text-muted py-8">
            <Loader2 className="w-4 h-4 animate-spin" />
            Running simulation...
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 p-3 rounded-xl text-red-400 text-sm">
          <AlertTriangle className="w-4 h-4 inline mr-2" />
          {error}
        </div>
      )}
    </div>
  );

  const renderConfirmStep = () => (
    <div className="space-y-4">
      <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-xl">
        <h4 className="text-sm font-bold text-red-400 mb-2 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          Final Confirmation Required
        </h4>
        <p className="text-sm text-muted">
          This action will upgrade the contract on-chain. Once executed, this operation cannot be
          undone. Please verify all details before proceeding.
        </p>
      </div>

      <div className="bg-black/20 border border-hi p-4 rounded-xl space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted">Contract:</span>
          <span className="font-mono">{contract && formatContractId(contract.contractId)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted">Network:</span>
          <span className="capitalize">{network}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted">New WASM:</span>
          <span className="font-mono text-accent">{formatWasmHash(newWasmHash)}</span>
        </div>
        {simulationResult?.estimatedFee && (
          <div className="flex justify-between">
            <span className="text-muted">Est. Fee:</span>
            <span className="font-mono">{simulationResult.estimatedFee}</span>
          </div>
        )}
      </div>

      <div>
        <label className="block text-xs font-bold uppercase tracking-widest text-red-400 mb-2">
          Admin Secret Key (Required)
        </label>
        <input
          type="password"
          value={adminSecret}
          onChange={(e) => setAdminSecret(e.target.value.trim())}
          placeholder="S..."
          className="w-full bg-black/20 border border-red-500/30 rounded-xl p-3 text-text font-mono outline-none focus:border-red-500"
          autoComplete="off"
        />
        <p className="text-xs text-muted mt-1">
          Enter the admin secret key to authorize this upgrade
        </p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 p-3 rounded-xl text-red-400 text-sm">
          <AlertTriangle className="w-4 h-4 inline mr-2" />
          {error}
        </div>
      )}
    </div>
  );

  const renderExecutingStep = () => (
    <div className="flex flex-col items-center justify-center py-12 space-y-4">
      <Loader2 className="w-12 h-12 text-accent animate-spin" />
      <p className="text-lg font-bold">Executing Upgrade...</p>
      <p className="text-sm text-muted">Please wait while the upgrade is processed on-chain</p>
    </div>
  );

  const renderCompleteStep = () => (
    <div className="space-y-4">
      <div className="bg-emerald-500/10 border border-emerald-500/30 p-6 rounded-xl text-center">
        <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
        <h4 className="text-xl font-bold text-emerald-500 mb-2">Upgrade Successful!</h4>
        <p className="text-sm text-muted">The contract has been upgraded successfully.</p>
      </div>

      {executionResult && (
        <div className="bg-black/20 border border-hi p-4 rounded-xl space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted">Transaction Hash:</span>
            <span className="font-mono text-xs">
              {executionResult.transactionHash
                ? `${executionResult.transactionHash.slice(0, 8)}...${executionResult.transactionHash.slice(-8)}`
                : 'N/A'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">New WASM Hash:</span>
            <span className="font-mono text-xs text-accent">
              {executionResult.newWasmHash && formatWasmHash(executionResult.newWasmHash)}
            </span>
          </div>
          {executionResult.ledgerSequence && (
            <div className="flex justify-between">
              <span className="text-muted">Ledger:</span>
              <span className="font-mono">{executionResult.ledgerSequence}</span>
            </div>
          )}
        </div>
      )}

      <button
        onClick={onClose}
        className="w-full py-4 bg-emerald-500/20 text-emerald-500 border border-emerald-500/50 font-black rounded-xl hover:bg-emerald-500 hover:text-white transition-all"
      >
        Close
      </button>
    </div>
  );

  // ----------------------------------------------------------------------------
  // Main Render
  // ----------------------------------------------------------------------------

  if (!isOpen) return null;

  const renderStepContent = () => {
    switch (step) {
      case 'input':
        return renderInputStep();
      case 'diff':
        return renderDiffStep();
      case 'simulation':
        return renderSimulationStep();
      case 'confirm':
        return renderConfirmStep();
      case 'executing':
        return renderExecutingStep();
      case 'complete':
        return renderCompleteStep();
      default:
        return null;
    }
  };

  const canGoNext =
    step === 'input'
      ? newWasmHash.length === 64
      : step === 'diff'
        ? true
        : step === 'simulation'
          ? simulationResult?.success
          : step === 'confirm'
            ? adminSecret.length > 0 && !isExecuting
            : false;

  const canGoBack = ['diff', 'simulation', 'confirm'].includes(step) && !isExecuting;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-surface border border-hi rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-hi">
          <h3 className="text-xl font-bold">Upgrade Contract</h3>
          {step !== 'executing' && step !== 'complete' && (
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/5 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-muted" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-6">
          {step !== 'complete' && renderStepIndicator()}
          {renderStepContent()}
        </div>

        {/* Footer */}
        {step !== 'complete' && step !== 'executing' && (
          <div className="flex items-center justify-between p-6 border-t border-hi">
            <button
              onClick={handleBack}
              disabled={!canGoBack}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-muted hover:text-text disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>

            <button
              onClick={handleNext}
              disabled={!canGoNext || isLoading}
              className="flex items-center gap-2 px-6 py-2 bg-accent text-white text-sm font-bold rounded-xl hover:bg-accent/80 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing...
                </>
              ) : step === 'confirm' ? (
                <>
                  <Shield className="w-4 h-4" />
                  Execute Upgrade
                </>
              ) : (
                <>
                  Next
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
