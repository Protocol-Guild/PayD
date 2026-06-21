export interface PathPaymentConfig {
  organizationId: number;
  employerAddress: string;
  defaultSourceAsset: AssetInfo;
  maxSlippageBps: number;
  maxPriceImpactBps: number;
  autoApproveThreshold: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AssetInfo {
  code: string;
  issuer: string | null;
  isNative: boolean;
}

export interface PayrollExecutionResponse {
  success: boolean;
  batchId?: string;
  contractBatchId?: number;
  totalEmployees: number;
  successfulPayments: number;
  failedPayments: number;
  totalSourceAmount?: string;
  totalDestinationAmount?: string;
  errors?: Array<{
    employeeId: string;
    error: string;
  }>;
}

export interface CostEstimateResponse {
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
    warnings?: string[];
  };
}

export interface PayrollRunStatus {
  id: string;
  organizationId: number;
  employerAddress: string;
  sourceAsset: AssetInfo;
  paymentType: 'strict_send' | 'strict_receive';
  totalEmployees: number;
  successfulPayments: number;
  failedPayments: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: Date;
  completedAt?: Date;
}

export interface PathDiscoveryRequest {
  sourceAsset: AssetInfo;
  destinationAsset: AssetInfo;
  amount: string;
  amountType: 'source' | 'destination';
}

export interface PathDiscoveryResponse {
  success: boolean;
  paths?: Array<{
    path: string[];
    estimatedSourceAmount: string;
    estimatedDestinationAmount: string;
    slippage: number;
    priceImpact: number;
    optimal?: boolean;
  }>;
}

export interface SupportedAssetsResponse {
  success: boolean;
  assets?: AssetInfo[];
  totalAssets: number;
}

export interface LiquidityStatsResponse {
  success: boolean;
  stats?: {
    totalPools: number;
    totalLiquidity: string;
    averageSpread: number;
  };
}