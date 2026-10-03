import {
  BASE_FEE,
  Contract,
  Networks,
  rpc,
  TransactionBuilder,
  nativeToScVal,
} from '@stellar/stellar-sdk';
import { simulateTransaction } from './transactionSimulation';
import { API_V1_BASE_URL } from '../config/api';

const DEFAULT_RPC_URL =
  (import.meta.env.PUBLIC_STELLAR_RPC_URL as string | undefined) ||
  'https://soroban-testnet.stellar.org';

export interface ConversionPath {
  id: string;
  sourceAsset: string;
  destinationAsset: string;
  rate: number;
  fee: number;
  slippage: number;
  estimatedDestinationAmount: number;
  hops: string[];
}

export interface PathfindRequest {
  fromAsset: string;
  toAsset: string;
  amount: number;
}

export interface SubmitCrossAssetPaymentInput {
  contractId: string;
  sourceAddress: string;
  signTransaction: (xdr: string) => Promise<string>;
  amount: number;
  fromAsset: string;
  toAsset: string;
  receiver: string;
  selectedPathId: string;
  rpcUrlOverride?: string;
}

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

function getNetworkPassphrase(): string {
  const network = (import.meta.env.PUBLIC_STELLAR_NETWORK as string | undefined)?.toUpperCase();
  return network === 'MAINNET' ? Networks.PUBLIC : Networks.TESTNET;
}

function isConversionPath(value: unknown, request: PathfindRequest): value is ConversionPath {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const path = value as Partial<ConversionPath>;
  return (
    typeof path.id === 'string' &&
    path.id.trim().length > 0 &&
    path.sourceAsset === request.fromAsset &&
    path.destinationAsset === request.toAsset &&
    typeof path.rate === 'number' &&
    Number.isFinite(path.rate) &&
    path.rate > 0 &&
    typeof path.fee === 'number' &&
    Number.isFinite(path.fee) &&
    path.fee >= 0 &&
    typeof path.slippage === 'number' &&
    Number.isFinite(path.slippage) &&
    path.slippage >= 0 &&
    typeof path.estimatedDestinationAmount === 'number' &&
    Number.isFinite(path.estimatedDestinationAmount) &&
    path.estimatedDestinationAmount > 0 &&
    Array.isArray(path.hops) &&
    path.hops.every((hop) => typeof hop === 'string' && hop.trim().length > 0)
  );
}

export async function fetchConversionPaths(
  request: PathfindRequest,
  signal?: AbortSignal
): Promise<ConversionPath[]> {
  const endpoint = `${API_V1_BASE_URL}/payments/pathfind`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
    signal,
  });

  if (!response.ok) {
    throw new Error(`Pathfinding endpoint unavailable (${response.status})`);
  }

  const payload: unknown = await response.json();
  if (!payload || typeof payload !== 'object' || !('paths' in payload)) {
    throw new Error('Invalid pathfinding response.');
  }
  const paths: unknown = payload.paths;
  if (!Array.isArray(paths) || !paths.every((path) => isConversionPath(path, request))) {
    throw new Error('Invalid pathfinding response.');
  }
  if (new Set(paths.map((path) => path.id)).size !== paths.length) {
    throw new Error('Invalid pathfinding response: duplicate path identifiers.');
  }
  return paths;
}

export async function submitCrossAssetPayment(
  input: SubmitCrossAssetPaymentInput
): Promise<{ txHash: string }> {
  const rpcUrl = normalizeBaseUrl(input.rpcUrlOverride || DEFAULT_RPC_URL);
  const server = new rpc.Server(rpcUrl, { allowHttp: rpcUrl.startsWith('http://') });
  const account = await server.getAccount(input.sourceAddress);
  const contract = new Contract(input.contractId);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: getNetworkPassphrase(),
  })
    .addOperation(
      contract.call(
        'execute_cross_asset_payment',
        nativeToScVal(input.receiver),
        nativeToScVal(input.fromAsset),
        nativeToScVal(input.toAsset),
        nativeToScVal(input.amount),
        nativeToScVal(input.selectedPathId)
      )
    )
    .setTimeout(60)
    .build();

  const simulation = await simulateTransaction({ envelopeXdr: tx.toXDR() });
  if (!simulation.success) {
    throw new Error(simulation.description || 'Simulation failed for cross-asset payment');
  }

  const prepared = await server.prepareTransaction(tx);
  const signedXdr = await input.signTransaction(prepared.toXDR());
  const signedTx = TransactionBuilder.fromXDR(signedXdr, getNetworkPassphrase());
  const submitted = await server.sendTransaction(signedTx);

  if (submitted.status === 'ERROR') {
    throw new Error('Cross-asset contract submission failed.');
  }

  return { txHash: submitted.hash };
}
