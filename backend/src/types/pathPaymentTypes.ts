/**
 * Comprehensive type definitions for Stellar Path Payments integration
 */

export interface StellarAsset {
  code: string;
  issuer: string | null;
  isNative: boolean;
}

export interface PathPaymentOperation {
  id: string;
  type: 'strict_send' | 'strict_receive';
  sourceAsset: StellarAsset;
  destinationAsset: StellarAsset;
  sourceAmount?: string;
  destinationAmount?: string;
  maximumSourceAmount?: string;
  minimumDestinationAmount?: string;
  path: StellarAsset[];
  status: PathPaymentStatus;
  createdAt: Date;
  completedAt?: Date;
  errorMessage?: string;
}

export type PathPaymentStatus = 
  | 'pending'
  | 'processing' 
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'expired';

export interface PayrollPathPaymentConfig {
  organizationId: number;
  employerAddress: string;
  defaultSourceAsset: StellarAsset;
  maxSlippageBps: number;
  maxPriceImpactBps: number;
  autoApproveThreshold: string;
  batchSizeLimit: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PayrollBatchRequest {
  sourceAsset: StellarAsset;
  paymentType: 'strict_send' | 'strict_receive';
  employees: EmployeePathPaymentRequest[];
  maxSlippageBps?: number;
  maxPriceImpactBps?: number;
  executeImmediately?: boolean;
}

export interface EmployeePathPaymentRequest {
  employeeId: number;
  employeeAddress: string;
  destinationAsset: StellarAsset;
  destinationAmount: string;
  maximumSourceAmount?: string;
  minimumDestinationAmount?: string;
  metadata?: Record<string, any>;
}

export interface PayrollBatchExecution {
  batchId: string;
  organizationId: number;
  employerAddress: string;
  sourceAsset: StellarAsset;
  paymentType: 'strict_send' | 'strict_receive';
  totalEmployees: number;
  processedEmployees: number;
  successfulPayments: number;
  failedPayments: number;
  totalSourceAmount?: string;
  totalDestinationAmount?: string;
  averageSlippage?: number;
  averagePriceImpact?: number;
  status: BatchExecutionStatus;
  contractBatchId?: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  errorMessage?: string;
  metadata?: Record<string, any>;
}

export type BatchExecutionStatus = 
  | 'queued'
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'partially_completed'
  | 'cancelled'
  | 'expired';

export interface EmployeePathPaymentExecution {
  id: string;
  batchId: string;
  employeeId: number;
  employeeAddress: string;
  sourceAsset: StellarAsset;
  destinationAsset: StellarAsset;
  requestedSourceAmount?: string;
  requestedDestinationAmount: string;
  maximumSourceAmount: string;
  minimumDestinationAmount: string;
  actualSourceAmount?: string;
  actualDestinationAmount?: string;
  slippage?: number;
  priceImpact?: number;
  fees?: string;
  path?: StellarAsset[];
  status: PathPaymentStatus;
  transactionHash?: string;
  ledgerSequence?: number;
  errorCode?: number;
  errorMessage?: string;
  retryCount: number;
  createdAt: Date;
  processedAt?: Date;
  metadata?: Record<string, any>;
}

export interface PathDiscoveryRequest {
  sourceAsset: StellarAsset;
  destinationAsset: StellarAsset;
  amount: string;
  amountType: 'source' | 'destination';
  maxPathLength?: number;
  maxSlippageBps?: number;
  maxPriceImpactBps?: number;
  excludeAssets?: StellarAsset[];
}

export interface PathDiscoveryResult {
  paths: PathOption[];
  recommendedPath?: PathOption;
  totalPathsFound: number;
  feasiblePaths: number;
  averageSlippage: number;
  averagePriceImpact: number;
  estimatedExecutionTime: number;
  liquidityScore: number;
}

export interface PathOption {
  path: StellarAsset[];
  estimatedSourceAmount: string;
  estimatedDestinationAmount: string;
  slippage: number;
  priceImpact: number;
  totalFees: string;
  confidence: number;
  executionTime: number;
  feasible: boolean;
  optimal?: boolean;
  riskScore: number;
  liquidityDepth: string[];
  errorReason?: string;
}

export interface LiquidityPoolInfo {
  poolId: string;
  assetA: StellarAsset;
  assetB: StellarAsset;
  reserves: {
    assetA: string;
    assetB: string;
  };
  totalShares: string;
  tradingFee: number; // in basis points
  volume24h: string;
  volume7d: string;
  fees24h: string;
  apr: number;
  lastUpdated: Date;
}

export interface MarketData {
  asset: StellarAsset;
  price: string;
  priceChange24h: number;
  volume24h: string;
  marketCap?: string;
  circulatingSupply?: string;
  lastUpdated: Date;
}

export interface PathPaymentEstimate {
  sourceAmount: string;
  destinationAmount: string;
  maximumSourceAmount: string;
  minimumDestinationAmount: string;
  estimatedSlippage: number;
  estimatedPriceImpact: number;
  estimatedFees: string;
  confidence: number;
  recommendedPath: StellarAsset[];
  alternativePaths: PathOption[];
  marketConditions: {
    liquidity: 'high' | 'medium' | 'low';
    volatility: 'high' | 'medium' | 'low';
    spread: number;
  };
  riskFactors: string[];
  executionRecommendations: string[];
}

export interface PathPaymentAnalytics {
  totalPayments: number;
  totalVolume: string;
  averageSlippage: number;
  averagePriceImpact: number;
  successRate: number;
  averageExecutionTime: number;
  mostUsedPaths: {
    path: StellarAsset[];
    count: number;
    successRate: number;
  }[];
  costSavings: {
    totalSavings: string;
    averageSavingsPerPayment: string;
    savingsVsDirectTransfer: number;
  };
  timeRange: {
    from: Date;
    to: Date;
  };
}

export interface PathPaymentWebhook {
  eventType: PathPaymentEventType;
  timestamp: Date;
  organizationId: number;
  batchId?: string;
  paymentId?: string;
  data: Record<string, any>;
  signature: string;
}

export type PathPaymentEventType = 
  | 'batch.created'
  | 'batch.processing'
  | 'batch.completed'
  | 'batch.failed'
  | 'payment.initiated'
  | 'payment.completed'
  | 'payment.failed'
  | 'payment.retry'
  | 'config.updated'
  | 'liquidity.warning'
  | 'slippage.exceeded';

export interface PathPaymentError {
  code: string;
  message: string;
  details?: Record<string, any>;
  retryable: boolean;
  suggestedAction?: string;
}

export interface PathPaymentMetrics {
  timestamp: Date;
  organizationId: number;
  totalActiveConfigs: number;
  totalBatchesProcessed: number;
  totalPaymentsProcessed: number;
  totalVolumeProcessed: string;
  averageSuccessRate: number;
  averageSlippage: number;
  averagePriceImpact: number;
  averageExecutionTime: number;
  topAssetPairs: {
    sourceAsset: StellarAsset;
    destinationAsset: StellarAsset;
    volume: string;
    count: number;
  }[];
  performanceScore: number;
}

export interface PathPaymentAuditLog {
  id: string;
  timestamp: Date;
  organizationId: number;
  userId: number;
  action: string;
  resource: string;
  resourceId?: string;
  changes?: Record<string, any>;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

// API Request/Response Types

export interface ConfigurePathPaymentRequest {
  employerAddress: string;
  defaultSourceAsset: StellarAsset;
  maxSlippageBps: number;
  maxPriceImpactBps: number;
  autoApproveThreshold: string;
  batchSizeLimit?: number;
  isActive?: boolean;
}

export interface ConfigurePathPaymentResponse {
  success: boolean;
  config?: PayrollPathPaymentConfig;
  message?: string;
  errors?: string[];
}

export interface ExecutePayrollBatchRequest {
  employees: EmployeePathPaymentRequest[];
  paymentType?: 'strict_send' | 'strict_receive';
  sourceAsset?: StellarAsset;
  maxSlippageBps?: number;
  maxPriceImpactBps?: number;
  executeImmediately?: boolean;
}

export interface ExecutePayrollBatchResponse {
  success: boolean;
  batchId?: string;
  contractBatchId?: number;
  totalEmployees?: number;
  estimatedSourceAmount?: string;
  estimatedDestinationAmount?: string;
  errors?: Array<{
    employeeId: string;
    error: string;
  }>;
  message?: string;
}

export interface GetPayrollBatchStatusResponse {
  success: boolean;
  batch?: PayrollBatchExecution;
  employees?: EmployeePathPaymentExecution[];
  message?: string;
}

export interface EstimatePayrollCostsRequest {
  sourceAsset: StellarAsset;
  employees: Array<{
    destinationAsset: StellarAsset;
    destinationAmount: string;
  }>;
  paymentType?: 'strict_send' | 'strict_receive';
  maxSlippageBps?: number;
  maxPriceImpactBps?: number;
}

export interface EstimatePayrollCostsResponse {
  success: boolean;
  estimate?: {
    totalEstimatedSourceCost: string;
    totalDestinationAmount: string;
    averageSlippage: number;
    averagePriceImpact: number;
    feasibleEmployees: number;
    infeasibleEmployees: Array<{
      index: number;
      reason: string;
    }>;
    confidenceScore: number;
    recommendedBatchSize?: number;
    warnings?: string[];
  };
  message?: string;
}

export interface FindOptimalPathsRequest {
  sourceAsset: StellarAsset;
  destinationAsset: StellarAsset;
  amount: string;
  amountType: 'source' | 'destination';
  maxPathLength?: number;
  maxSlippageBps?: number;
  maxPriceImpactBps?: number;
}

export interface FindOptimalPathsResponse {
  success: boolean;
  paths?: PathOption[];
  recommendedPath?: PathOption;
  totalPathsFound?: number;
  message?: string;
}

export interface GetSupportedAssetsResponse {
  success: boolean;
  assets?: StellarAsset[];
  totalAssets?: number;
  lastUpdated?: Date;
  message?: string;
}

export interface GetLiquidityStatsResponse {
  success: boolean;
  stats?: {
    totalPools: number;
    totalLiquidity: string;
    totalVolume24h: string;
    averageSpread: number;
    topPools: Array<{
      poolId: string;
      assetPair: string;
      liquidity: string;
      volume24h: string;
      apr: number;
    }>;
  };
  message?: string;
}