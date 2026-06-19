import { AssetInfo } from '../services/assetPathPaymentService.js';

/**
 * Path payment utility functions for PayD
 */

export interface PathOption {
  path: string[];
  estimatedSourceAmount: string;
  estimatedDestinationAmount: string;
  slippage: number;
  priceImpact: number;
  fees: string;
  optimal?: boolean;
  feasible: boolean;
  errorReason?: string;
}

export interface AssetPair {
  sourceAsset: AssetInfo;
  destinationAsset: AssetInfo;
}

export interface PaymentEstimate {
  sourceAmount: string;
  destinationAmount: string;
  slippage: number;
  priceImpact: number;
  fees: string;
  confidence: number; // 0-1 scale
}

export interface LiquidityPool {
  id: string;
  assetA: AssetInfo;
  assetB: AssetInfo;
  reserves: {
    assetA: string;
    assetB: string;
  };
  totalShares: string;
  fee: number; // in basis points
  volume24h?: string;
  lastUpdated: Date;
}

/**
 * Normalize asset information to standard format
 */
export function normalizeAsset(asset: Partial<AssetInfo>): AssetInfo {
  if (!asset.code) {
    throw new Error('Asset code is required');
  }

  const normalized: AssetInfo = {
    code: asset.code.toUpperCase(),
    issuer: asset.issuer || null,
    isNative: asset.code.toUpperCase() === 'XLM',
  };

  // Validate native XLM doesn't have issuer
  if (normalized.isNative && normalized.issuer) {
    throw new Error('Native XLM should not have an issuer');
  }

  // Validate non-native assets
  if (!normalized.isNative && normalized.issuer && normalized.issuer.length !== 56) {
    throw new Error('Asset issuer must be a valid 56-character Stellar public key');
  }

  return normalized;
}

/**
 * Create a unique identifier for an asset pair
 */
export function getAssetPairId(assetA: AssetInfo, assetB: AssetInfo): string {
  const a = assetA.isNative ? 'XLM' : `${assetA.code}:${assetA.issuer}`;
  const b = assetB.isNative ? 'XLM' : `${assetB.code}:${assetB.issuer}`;
  
  // Sort alphabetically for consistent pair ID regardless of order
  return [a, b].sort().join('|');
}

/**
 * Calculate slippage percentage from amounts
 */
export function calculateSlippage(expectedAmount: string, actualAmount: string): number {
  const expected = parseFloat(expectedAmount);
  const actual = parseFloat(actualAmount);
  
  if (expected <= 0) {
    throw new Error('Expected amount must be positive');
  }
  
  return Math.abs(expected - actual) / expected;
}

/**
 * Calculate price impact for a trade
 */
export function calculatePriceImpact(
  tradeAmount: string,
  poolReserve: string,
  isSourceAmount: boolean = true
): number {
  const trade = parseFloat(tradeAmount);
  const reserve = parseFloat(poolReserve);
  
  if (trade <= 0 || reserve <= 0) {
    return 0;
  }
  
  // Simple price impact calculation: trade_amount / pool_reserve
  // More sophisticated models would use constant product formula
  const impact = trade / reserve;
  
  // Cap at 100% price impact
  return Math.min(impact, 1.0);
}

/**
 * Format amount to Stellar precision (7 decimal places max)
 */
export function formatStellarAmount(amount: string | number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  if (isNaN(num)) {
    throw new Error('Invalid amount for formatting');
  }
  
  // Round to 7 decimal places and remove trailing zeros
  return parseFloat(num.toFixed(7)).toString();
}

/**
 * Validate amount meets Stellar network requirements
 */
export function validateStellarAmount(amount: string): boolean {
  const num = parseFloat(amount);
  
  // Must be positive
  if (num <= 0) {
    return false;
  }
  
  // Check decimal places (max 7 for Stellar)
  const decimalPlaces = (amount.split('.')[1] || '').length;
  if (decimalPlaces > 7) {
    return false;
  }
  
  // Check minimum amount (0.0000001 XLM)
  const minAmount = 0.0000001;
  if (num < minAmount) {
    return false;
  }
  
  return true;
}

/**
 * Compare two assets for equality
 */
export function assetsEqual(assetA: AssetInfo, assetB: AssetInfo): boolean {
  if (assetA.code !== assetB.code) {
    return false;
  }
  
  // For native XLM, both should have null issuer
  if (assetA.isNative && assetB.isNative) {
    return assetA.issuer === assetB.issuer; // Should both be null
  }
  
  // For non-native assets, compare issuers
  return assetA.issuer === assetB.issuer;
}

/**
 * Generate possible paths between two assets
 */
export function generatePossiblePaths(
  sourceAsset: AssetInfo,
  destinationAsset: AssetInfo,
  intermediateAssets: AssetInfo[],
  maxPathLength: number = 3
): AssetInfo[][] {
  const paths: AssetInfo[][] = [];
  
  // Direct path (no intermediary)
  if (!assetsEqual(sourceAsset, destinationAsset)) {
    paths.push([sourceAsset, destinationAsset]);
  }
  
  // Single intermediary paths
  if (maxPathLength >= 3) {
    for (const intermediate of intermediateAssets) {
      if (!assetsEqual(sourceAsset, intermediate) && 
          !assetsEqual(destinationAsset, intermediate)) {
        paths.push([sourceAsset, intermediate, destinationAsset]);
      }
    }
  }
  
  // Double intermediary paths (for complex routing)
  if (maxPathLength >= 4 && intermediateAssets.length >= 2) {
    for (let i = 0; i < intermediateAssets.length; i++) {
      for (let j = i + 1; j < intermediateAssets.length; j++) {
        const int1 = intermediateAssets[i];
        const int2 = intermediateAssets[j];
        
        if (!assetsEqual(sourceAsset, int1) && 
            !assetsEqual(sourceAsset, int2) &&
            !assetsEqual(destinationAsset, int1) && 
            !assetsEqual(destinationAsset, int2) &&
            !assetsEqual(int1, int2)) {
          paths.push([sourceAsset, int1, int2, destinationAsset]);
          paths.push([sourceAsset, int2, int1, destinationAsset]);
        }
      }
    }
  }
  
  return paths;
}

/**
 * Estimate gas/fee costs for path payments
 */
export function estimatePathPaymentFees(pathLength: number, baseFeeBps: number = 30): string {
  // Base fee for Stellar transaction
  const baseFee = 0.00001; // 100 stroops
  
  // Additional fees for each hop in the path
  const hopFee = baseFee * 0.5; // 50 stroops per hop
  
  // Path-specific fees (DEX trading fees, etc.)
  const pathFees = (pathLength - 1) * (baseFeeBps / 10000) * 0.001; // Estimated trading fees
  
  const totalFee = baseFee + (hopFee * (pathLength - 1)) + pathFees;
  
  return formatStellarAmount(totalFee);
}

/**
 * Calculate confidence score for a payment path
 */
export function calculatePathConfidence(
  path: AssetInfo[],
  liquidity: string[],
  volume24h: string[],
  slippage: number,
  priceImpact: number
): number {
  let confidence = 1.0;
  
  // Penalize longer paths
  confidence *= Math.pow(0.9, path.length - 2);
  
  // Penalize low liquidity
  const avgLiquidity = liquidity.reduce((sum, liq) => sum + parseFloat(liq), 0) / liquidity.length;
  if (avgLiquidity < 1000) confidence *= 0.7;
  else if (avgLiquidity < 10000) confidence *= 0.85;
  
  // Penalize low volume
  const avgVolume = volume24h.reduce((sum, vol) => sum + parseFloat(vol), 0) / volume24h.length;
  if (avgVolume < 100) confidence *= 0.6;
  else if (avgVolume < 1000) confidence *= 0.8;
  
  // Penalize high slippage
  if (slippage > 0.1) confidence *= 0.5; // >10% slippage
  else if (slippage > 0.05) confidence *= 0.7; // >5% slippage
  else if (slippage > 0.02) confidence *= 0.9; // >2% slippage
  
  // Penalize high price impact
  if (priceImpact > 0.1) confidence *= 0.4; // >10% price impact
  else if (priceImpact > 0.05) confidence *= 0.7; // >5% price impact
  else if (priceImpact > 0.02) confidence *= 0.9; // >2% price impact
  
  return Math.max(0, Math.min(1, confidence));
}

/**
 * Sort paths by optimality (considering slippage, fees, confidence)
 */
export function sortPathsByOptimality(paths: PathOption[]): PathOption[] {
  return paths.sort((a, b) => {
    // First, sort by feasibility
    if (a.feasible && !b.feasible) return -1;
    if (!a.feasible && b.feasible) return 1;
    
    if (!a.feasible && !b.feasible) return 0; // Both infeasible
    
    // For feasible paths, calculate optimality score
    const getOptimalityScore = (path: PathOption): number => {
      let score = 0;
      
      // Lower slippage is better
      score += (1 - path.slippage) * 0.4;
      
      // Lower price impact is better  
      score += (1 - path.priceImpact) * 0.3;
      
      // Lower fees are better (normalize by assuming max fee of 1% of amount)
      const feesNormalized = Math.min(parseFloat(path.fees) / (parseFloat(path.estimatedSourceAmount) * 0.01), 1);
      score += (1 - feesNormalized) * 0.2;
      
      // Shorter paths are generally better
      score += (4 - path.path.length) / 4 * 0.1;
      
      return score;
    };
    
    return getOptimalityScore(b) - getOptimalityScore(a);
  });
}

/**
 * Create mock liquidity data for testing
 */
export function createMockLiquidityData(): LiquidityPool[] {
  const xlm: AssetInfo = { code: 'XLM', issuer: null, isNative: true };
  const usdc: AssetInfo = { 
    code: 'USDC', 
    issuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN', 
    isNative: false 
  };
  const eur: AssetInfo = { 
    code: 'EUR', 
    issuer: 'GCQTOZ3ISCHKXQ7DWKFVGEG5DTHBZ4QY24FWGHQG6GQJYU62JFGR4PHT', 
    isNative: false 
  };
  const gbp: AssetInfo = { 
    code: 'GBP', 
    issuer: 'GCURWNKH7JMLY23X3OQZDY6NEZPBDY6QPGNEEDC4H7F5LYCX4PIED7WJ', 
    isNative: false 
  };
  
  return [
    {
      id: 'xlm-usdc',
      assetA: xlm,
      assetB: usdc,
      reserves: { assetA: '1000000', assetB: '400000' },
      totalShares: '632455',
      fee: 30, // 0.3%
      volume24h: '50000',
      lastUpdated: new Date(),
    },
    {
      id: 'usdc-eur',
      assetA: usdc,
      assetB: eur,
      reserves: { assetA: '200000', assetB: '180000' },
      totalShares: '189736',
      fee: 30,
      volume24h: '25000',
      lastUpdated: new Date(),
    },
    {
      id: 'xlm-eur',
      assetA: xlm,
      assetB: eur,
      reserves: { assetA: '500000', assetB: '180000' },
      totalShares: '300000',
      fee: 30,
      volume24h: '15000',
      lastUpdated: new Date(),
    },
    {
      id: 'eur-gbp',
      assetA: eur,
      assetB: gbp,
      reserves: { assetA: '100000', assetB: '85000' },
      totalShares: '92195',
      fee: 30,
      volume24h: '8000',
      lastUpdated: new Date(),
    },
  ];
}

/**
 * Retry wrapper for path payment operations
 */
export async function retryPathPaymentOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt < maxRetries) {
        // Exponential backoff
        const delay = delayMs * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
    }
  }
  
  throw lastError!;
}