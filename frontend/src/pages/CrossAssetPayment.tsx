import { useState, useEffect, useRef } from 'react';
import {
  Loader2,
  ArrowRightLeft,
  ShieldCheck,
  Info,
  CheckCircle2,
  Radio,
  Wallet,
} from 'lucide-react';
import { useNotification } from '../hooks/useNotification';
import { useSocket } from '../hooks/useSocket';
import { useWallet } from '../hooks/useWallet';
import { useContractError } from '../hooks/useContractError';
import { ContractErrorPanel } from '../components/ContractErrorPanel';
import { contractService } from '../services/contracts';
import {
  fetchConversionPaths,
  submitCrossAssetPayment,
  type ConversionPath,
} from '../services/crossAssetPayment';

type QuoteResult =
  | { requestKey: string; status: 'success'; paths: ConversionPath[] }
  | { requestKey: string; status: 'unavailable'; message: string };

export default function CrossAssetPayment() {
  const { notifySuccess, notifyError } = useNotification();
  const { address, signTransaction, connect } = useWallet();
  const { socket } = useSocket();
  const { contractError, handleContractError, clearContractError } = useContractError();
  const [assetIn, setAssetIn] = useState('USDC');
  const [assetOut, setAssetOut] = useState('XLM');
  const [amount, setAmount] = useState('');
  const [receiver, setReceiver] = useState('');

  const [quoteResult, setQuoteResult] = useState<QuoteResult | null>(null);
  const [selectedPathId, setSelectedPathId] = useState<string>('');
  const quoteController = useRef<AbortController | null>(null);
  const [submissionTxHash, setSubmissionTxHash] = useState<string | null>(null);
  const [liveStatusMessage, setLiveStatusMessage] = useState<string>('Waiting for submission...');
  const [status, setStatus] = useState<string>('idle');
  const isComplete = status === 'success' || status === 'completed' || status === 'confirmed';

  const requestKey = JSON.stringify([assetIn, assetOut, amount]);
  const parsedAmount = Number(amount);
  const hasValidAmount = Number.isFinite(parsedAmount) && parsedAmount > 0;
  // A result from a different input cannot be displayed or submitted, even
  // during the render before the previous request's effect is cleaned up.
  const currentQuote = quoteResult?.requestKey === requestKey ? quoteResult : null;
  const paths = currentQuote?.status === 'success' ? currentQuote.paths : [];
  const isLoadingPaths = hasValidAmount && currentQuote === null;
  const selectedPath = paths.find((path) => path.id === selectedPathId) ?? null;

  const invalidateQuote = () => {
    // Invalidate in the input event as well as effect cleanup: an old promise
    // may settle before the next passive effect, or after an A → B → A edit.
    quoteController.current?.abort();
    quoteController.current = null;
    setQuoteResult(null);
    setSelectedPathId('');
  };

  useEffect(() => {
    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return;
    }

    const controller = new AbortController();
    quoteController.current = controller;
    const isCurrentRequest = () =>
      !controller.signal.aborted && quoteController.current === controller;

    const timeout = setTimeout(() => {
      void (async () => {
        try {
          const nextPaths = await fetchConversionPaths(
            { fromAsset: assetIn, toAsset: assetOut, amount: parsedAmount },
            controller.signal
          );
          if (!isCurrentRequest()) return;
          setQuoteResult({ requestKey, status: 'success', paths: nextPaths });
          setSelectedPathId(nextPaths[0]?.id ?? '');
        } catch (error) {
          if (!isCurrentRequest()) return;
          setQuoteResult({
            requestKey,
            status: 'unavailable',
            message:
              error instanceof Error ? error.message : 'Unable to retrieve conversion paths.',
          });
          setSelectedPathId('');
        }
      })();
    }, 450);

    return () => {
      clearTimeout(timeout);
      controller.abort();
      if (quoteController.current === controller) quoteController.current = null;
    };
  }, [amount, assetIn, assetOut, requestKey]);

  useEffect(() => {
    if (!socket || !submissionTxHash) return;

    const handler = (payload: unknown) => {
      if (!payload || typeof payload !== 'object') return;
      const record = payload as Record<string, unknown>;
      const txHash = (record.txHash as string | undefined) || (record.hash as string | undefined);
      if (!txHash || txHash !== submissionTxHash) return;

      const newStatus = (record.status as string | undefined) || 'unknown';
      setLiveStatusMessage(`Update: ${newStatus}`);
      if (newStatus === 'confirmed' || newStatus === 'success') {
        notifySuccess('Payment Confirmed', 'Your cross-asset payment was successful.');
        setStatus('success');
      }
    };

    const activeSocket = socket;
    activeSocket.on('cross-asset:update', handler);
    activeSocket.on('transaction:update', handler);
    activeSocket.emit('subscribe:transaction', submissionTxHash);

    return () => {
      activeSocket.off('cross-asset:update', handler);
      activeSocket.off('transaction:update', handler);
      activeSocket.emit('unsubscribe:transaction', submissionTxHash);
    };
  }, [notifySuccess, socket, submissionTxHash]);

  const handleInitiate = async () => {
    clearContractError();
    if (!address) {
      notifyError('Wallet required', 'Connect your wallet before submitting cross-asset payment.');
      return;
    }
    const selectedQuoteController = quoteController.current;
    if (!selectedPath || !selectedQuoteController || selectedQuoteController.signal.aborted) {
      notifyError(
        'Quote required',
        'Wait for a conversion quote for the current asset pair and amount.'
      );
      return;
    }

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      notifyError('Invalid amount', 'Enter a valid payment amount.');
      return;
    }

    setStatus('submitting');
    try {
      await contractService.initialize();
      if (
        selectedQuoteController.signal.aborted ||
        quoteController.current !== selectedQuoteController
      ) {
        setStatus('idle');
        return;
      }
      const contractId =
        contractService.getContractId('cross_asset_payment', 'testnet') ||
        (import.meta.env.VITE_CROSS_ASSET_PAYMENT_CONTRACT_ID as string | undefined);
      if (!contractId) {
        throw new Error('Cross-asset contract ID is unavailable.');
      }

      const result: { txHash: string } = await submitCrossAssetPayment({
        contractId,
        sourceAddress: address,
        signTransaction,
        amount: parsedAmount,
        fromAsset: assetIn,
        toAsset: assetOut,
        receiver,
        selectedPathId: selectedPath.id,
      });

      setSubmissionTxHash(result.txHash);
      setStatus('pending');
      setLiveStatusMessage('Submitted. Waiting for live settlement updates...');
      notifySuccess('Payment submitted', `On-chain transaction hash: ${result.txHash}`);
    } catch (error) {
      console.error(error);
      setStatus('error');

      // Try to parse contract error if we have XDR (in a real scenario we'd get this from RPC)
      // For now, we simulate it if amount is 666
      if (amount === '666') {
        const mockErrorXdr = 'AAAABAAAAAEAAAABAAAABQ=='; // ScvError(ScError{type: SCE_CONTRACT, code: 5})
        handleContractError(mockErrorXdr);
      } else if (!contractError) {
        handleContractError(
          undefined,
          error instanceof Error
            ? error.message
            : 'An unexpected error occurred during contract invocation.'
        );
      }

      notifyError('Payment failed', 'A contract error occurred. Please review the details below.');
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-(--text) p-8 font-sans">
      <div className="max-w-4xl mx-auto">
        <header className="mb-12 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
              Cross-Asset Payment Settlement
            </h1>
            <p className="text-(--muted) mt-2">
              Live pathfinding, Soroban simulation, and wallet-signed contract submission.
            </p>
          </div>
          {!address ? (
            <button
              type="button"
              onClick={() => {
                void connect();
              }}
              className="px-4 py-2 rounded-full bg-accent text-on-accent font-semibold"
            >
              Connect Wallet
            </button>
          ) : (
            <span className="text-xs text-(--muted) font-mono">
              {address.slice(0, 6)}...{address.slice(-4)}
            </span>
          )}
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-[#16161a] border border-(--border) rounded-2xl p-8 shadow-2xl backdrop-blur-xl">
            <div className="space-y-6">
              <ContractErrorPanel error={contractError} />
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label
                    htmlFor="cross-asset-source"
                    className="block text-xs font-semibold text-(--muted) uppercase tracking-wider mb-2"
                  >
                    Send Asset
                  </label>
                  <select
                    id="cross-asset-source"
                    value={assetIn}
                    onChange={(e) => {
                      invalidateQuote();
                      setAssetIn(e.target.value);
                    }}
                    className="w-full bg-[#0a0a0c] border border-(--border) rounded-xl px-4 py-3 outline-none"
                  >
                    <option>USDC</option>
                    <option>XLM</option>
                  </select>
                </div>
                <div className="mt-6">
                  <ArrowRightLeft className="text-(--muted) h-6 w-6" />
                </div>
                <div className="flex-1">
                  <label
                    htmlFor="cross-asset-destination"
                    className="block text-xs font-semibold text-(--muted) uppercase tracking-wider mb-2"
                  >
                    Receive Asset
                  </label>
                  <select
                    id="cross-asset-destination"
                    value={assetOut}
                    onChange={(e) => {
                      invalidateQuote();
                      setAssetOut(e.target.value);
                    }}
                    className="w-full bg-[#0a0a0c] border border-(--border) rounded-xl px-4 py-3 outline-none"
                  >
                    <option>XLM</option>
                    <option>USDC</option>
                    <option>NGN</option>
                    <option>BRL</option>
                    <option>ARS</option>
                    <option>KES</option>
                  </select>
                </div>
              </div>

              <div>
                <label
                  htmlFor="cross-asset-amount"
                  className="block text-xs font-semibold text-(--muted) uppercase tracking-wider mb-2"
                >
                  Amount to Send
                </label>
                <div className="relative">
                  <input
                    id="cross-asset-amount"
                    type="number"
                    value={amount}
                    onChange={(e) => {
                      invalidateQuote();
                      setAmount(e.target.value);
                    }}
                    placeholder="0.00"
                    className="w-full bg-[#0a0a0c] border border-(--border) rounded-xl px-4 py-3 text-2xl font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-(--muted) font-bold">
                    {assetIn}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-(--muted) uppercase tracking-wider mb-2">
                  Receiver Address
                </label>
                <input
                  type="text"
                  value={receiver}
                  onChange={(e) => setReceiver(e.target.value)}
                  placeholder="G... recipient wallet"
                  className="w-full bg-[#0a0a0c] border border-(--border) rounded-xl px-4 py-3 outline-none"
                />
              </div>

              <button
                onClick={() => {
                  void handleInitiate();
                }}
                disabled={status === 'submitting' || status === 'pending' || !selectedPath}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 py-4 rounded-xl font-bold text-lg hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {status === 'submitting' ? (
                  <Loader2 className="animate-spin" />
                ) : !address ? (
                  <>
                    <Wallet className="w-5 h-5" /> Connect Wallet to Swap
                  </>
                ) : (
                  'Simulate + Submit Payment'
                )}
              </button>
            </div>
          </div>

          <div className="space-y-8">
            {/* Quote Panel */}
            {(isLoadingPaths || currentQuote !== null) && (
              <div className="bg-(--surface) border border-(--border) shadow-(--shadow-sm) rounded-2xl p-8 shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-500">
                <h3 className="text-lg font-bold flex items-center gap-2 mb-6">
                  <ShieldCheck className="text-emerald-400" />
                  Available Conversion Paths
                </h3>
                {isLoadingPaths ? (
                  <div role="status" className="flex items-center gap-2 text-sm text-(--muted)">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Fetching conversion paths...
                  </div>
                ) : currentQuote?.status === 'unavailable' ? (
                  <div role="alert" className="space-y-2 text-sm text-amber-300">
                    <p className="font-semibold">Quotes unavailable</p>
                    <p>{currentQuote.message}</p>
                  </div>
                ) : paths.length === 0 ? (
                  <p role="status" className="text-sm text-(--muted)">
                    No conversion paths are available for this asset pair and amount.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {paths.map((path) => (
                      <button
                        key={path.id}
                        type="button"
                        onClick={() => setSelectedPathId(path.id)}
                        className={`w-full text-left rounded-xl border px-4 py-3 transition ${selectedPathId === path.id ? 'border-emerald-500/60 bg-emerald-500/10' : 'border-(--border) hover:border-(--border-hi)'}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold flex items-center gap-2">
                            <Radio className="h-4 w-4" />
                            {path.hops.join(' -> ')}
                          </span>
                          <span className="text-xs text-(--muted)">
                            {path.rate.toFixed(4)} rate
                          </span>
                        </div>
                        <div className="mt-2 text-xs text-(--muted)">
                          Fee: {path.fee.toFixed(4)} {assetOut} | Slippage:{' '}
                          {path.slippage.toFixed(2)}%
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {selectedPath && (
              <div className="bg-[#16161a] border border-(--border) rounded-2xl p-6">
                <h4 className="font-bold mb-3">Settlement Preview</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-(--muted)">
                    <span>Expected Delivery</span>
                    <span className="text-(--text) font-mono">
                      {selectedPath.estimatedDestinationAmount.toLocaleString()} {assetOut}
                    </span>
                  </div>
                  <div className="flex justify-between text-(--muted)">
                    <span>Fee</span>
                    <span className="text-(--text)">
                      {selectedPath.fee.toFixed(4)} {assetOut}
                    </span>
                  </div>
                  <div className="flex justify-between text-(--muted)">
                    <span>Slippage</span>
                    <span className="text-(--text)">{selectedPath.slippage.toFixed(2)}%</span>
                  </div>
                </div>
              </div>
            )}

            {status !== 'idle' && (
              <div className="bg-[#16161a] border border-blue-900/30 rounded-2xl p-8 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4">
                  <div
                    className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest ${isComplete ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/20 text-blue-400'}`}
                  >
                    {status}
                  </div>
                </div>
                <h3 className="text-lg font-bold mb-6">Contract Status</h3>

                <div className="space-y-6">
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center ${status !== 'error' ? 'bg-emerald-500' : 'bg-(--muted)/40'}`}
                    >
                      <CheckCircle2 className="h-5 w-5 text-(--text)" />
                    </div>
                    <div>
                      <p className="font-bold">Authentication</p>
                      <p className="text-xs text-(--muted)">Wallet connected and signer ready</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center ${status === 'pending' || isComplete ? 'bg-emerald-500' : 'bg-(--muted)/40'}`}
                    >
                      {status === 'pending' ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-5 w-5 text-(--text)" />
                      )}
                    </div>
                    <div>
                      <p className="font-bold">Initiation</p>
                      <p className="text-xs text-(--muted)">
                        Contract call simulated and submitted
                      </p>
                    </div>
                  </div>

                  <div className={`flex items-center gap-4 ${isComplete ? '' : 'opacity-50'}`}>
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center ${isComplete ? 'bg-emerald-500' : 'bg-(--muted)/40'}`}
                    >
                      <CheckCircle2 className="h-5 w-5 text-(--text)" />
                    </div>
                    <div>
                      <p className="font-bold">Settlement</p>
                      <p className="text-xs text-(--muted)">{liveStatusMessage}</p>
                    </div>
                  </div>
                </div>

                {submissionTxHash && (
                  <div className="mt-8 pt-6 border-t border-(--border)">
                    <p className="text-xs text-(--muted) uppercase font-bold mb-2">
                      Transaction Hash
                    </p>
                    <p className="text-xs font-mono break-all text-blue-400">{submissionTxHash}</p>
                  </div>
                )}
              </div>
            )}

            {!hasValidAmount && (
              <div className="bg-blue-900/10 border border-blue-900/30 rounded-2xl p-6 flex gap-4">
                <Info className="text-blue-400 shrink-0" />
                <p className="text-sm text-blue-300">
                  Change asset pair and amount to request path options from backend proxy.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
