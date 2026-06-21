import { describe, it, expect, beforeEach } from 'vitest';
import {
  normalizeAsset,
  getAssetPairId,
  calculateSlippage,
  calculatePriceImpact,
  formatStellarAmount,
  validateStellarAmount,
  assetsEqual,
  generatePossiblePaths,
  estimatePathPaymentFees,
  calculatePathConfidence,
  sortPathsByOptimality,
  createMockLiquidityData,
  retryPathPaymentOperation,
} from '../pathPaymentHelpers.js';
import type { AssetInfo, PathOption } from '../../services/assetPathPaymentService.js';

describe('pathPaymentHelpers', () => {
  describe('normalizeAsset', () => {
    it('should normalize XLM as native asset', () => {
      const xlm = normalizeAsset({ code: 'xlm' });
      expect(xlm).toEqual({
        code: 'XLM',
        issuer: null,
        isNative: true,
      });
    });

    it('should normalize non-native asset', () => {
      const usdc = normalizeAsset({
        code: 'usdc',
        issuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
      });
      
      expect(usdc).toEqual({
        code: 'USDC',
        issuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
        isNative: false,
      });
    });

    it('should throw error for missing asset code', () => {
      expect(() => normalizeAsset({})).toThrow('Asset code is required');
    });

    it('should throw error for native asset with issuer', () => {
      expect(() => normalizeAsset({
        code: 'XLM',
        issuer: 'INVALID',
      })).toThrow('Native XLM should not have an issuer');
    });

    it('should throw error for invalid issuer length', () => {
      expect(() => normalizeAsset({
        code: 'USDC',
        issuer: 'INVALID',
      })).toThrow('Asset issuer must be a valid 56-character Stellar public key');
    });
  });

  describe('getAssetPairId', () => {
    it('should create consistent pair ID regardless of order', () => {
      const xlm: AssetInfo = { code: 'XLM', issuer: null, isNative: true };
      const usdc: AssetInfo = { 
        code: 'USDC', 
        issuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN', 
        isNative: false 
      };

      const id1 = getAssetPairId(xlm, usdc);
      const id2 = getAssetPairId(usdc, xlm);
      
      expect(id1).toBe(id2);
      expect(id1).toContain('XLM');
      expect(id1).toContain('USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN');
    });
  });

  describe('calculateSlippage', () => {
    it('should calculate slippage correctly', () => {
      const slippage = calculateSlippage('1000', '950');
      expect(slippage).toBe(0.05); // 5% slippage
    });

    it('should handle zero slippage', () => {
      const slippage = calculateSlippage('1000', '1000');
      expect(slippage).toBe(0);
    });

    it('should throw error for invalid expected amount', () => {
      expect(() => calculateSlippage('0', '950')).toThrow('Expected amount must be positive');
    });
  });

  describe('calculatePriceImpact', () => {
    it('should calculate price impact correctly', () => {
      const impact = calculatePriceImpact('1000', '10000');
      expect(impact).toBe(0.1); // 10% price impact
    });

    it('should cap price impact at 100%', () => {
      const impact = calculatePriceImpact('2000', '1000');
      expect(impact).toBe(1.0); // Capped at 100%
    });

    it('should return 0 for invalid amounts', () => {
      expect(calculatePriceImpact('0', '1000')).toBe(0);
      expect(calculatePriceImpact('1000', '0')).toBe(0);
    });
  });

  describe('formatStellarAmount', () => {
    it('should format amount to proper precision', () => {
      expect(formatStellarAmount('1.123456789')).toBe('1.1234568');
      expect(formatStellarAmount(1.5)).toBe('1.5');
      expect(formatStellarAmount('0.0000001')).toBe('0.0000001');
    });

    it('should remove trailing zeros', () => {
      expect(formatStellarAmount('1.5000000')).toBe('1.5');
      expect(formatStellarAmount('10.0')).toBe('10');
    });

    it('should throw error for invalid amount', () => {
      expect(() => formatStellarAmount('invalid')).toThrow('Invalid amount for formatting');
    });
  });

  describe('validateStellarAmount', () => {
    it('should validate correct amounts', () => {
      expect(validateStellarAmount('1.5')).toBe(true);
      expect(validateStellarAmount('0.0000001')).toBe(true);
      expect(validateStellarAmount('1000000')).toBe(true);
    });

    it('should reject invalid amounts', () => {
      expect(validateStellarAmount('0')).toBe(false);
      expect(validateStellarAmount('-1')).toBe(false);
      expect(validateStellarAmount('1.12345678')).toBe(false); // Too many decimal places
      expect(validateStellarAmount('0.00000001')).toBe(false); // Below minimum
    });
  });

  describe('assetsEqual', () => {
    it('should compare native assets correctly', () => {
      const xlm1: AssetInfo = { code: 'XLM', issuer: null, isNative: true };
      const xlm2: AssetInfo = { code: 'XLM', issuer: null, isNative: true };
      
      expect(assetsEqual(xlm1, xlm2)).toBe(true);
    });

    it('should compare non-native assets correctly', () => {
      const usdc1: AssetInfo = { 
        code: 'USDC', 
        issuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN', 
        isNative: false 
      };
      const usdc2: AssetInfo = { 
        code: 'USDC', 
        issuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN', 
        isNative: false 
      };
      
      expect(assetsEqual(usdc1, usdc2)).toBe(true);
    });

    it('should detect different assets', () => {
      const xlm: AssetInfo = { code: 'XLM', issuer: null, isNative: true };
      const usdc: AssetInfo = { 
        code: 'USDC', 
        issuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN', 
        isNative: false 
      };
      
      expect(assetsEqual(xlm, usdc)).toBe(false);
    });
  });

  describe('generatePossiblePaths', () => {
    let xlm: AssetInfo;
    let usdc: AssetInfo;
    let eur: AssetInfo;
    let gbp: AssetInfo;

    beforeEach(() => {
      xlm = { code: 'XLM', issuer: null, isNative: true };
      usdc = { 
        code: 'USDC', 
        issuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN', 
        isNative: false 
      };
      eur = { 
        code: 'EUR', 
        issuer: 'GCQTOZ3ISCHKXQ7DWKFVGEG5DTHBZ4QY24FWGHQG6GQJYU62JFGR4PHT', 
        isNative: false 
      };
      gbp = { 
        code: 'GBP', 
        issuer: 'GCURWNKH7JMLY23X3OQZDY6NEZPBDY6QPGNEEDC4H7F5LYCX4PIED7WJ', 
        isNative: false 
      };
    });

    it('should generate direct path', () => {
      const paths = generatePossiblePaths(usdc, eur, [xlm], 2);
      
      expect(paths).toHaveLength(1);
      expect(paths[0]).toEqual([usdc, eur]);
    });

    it('should generate single intermediary paths', () => {
      const paths = generatePossiblePaths(usdc, eur, [xlm], 3);
      
      expect(paths).toHaveLength(2);
      expect(paths).toContainEqual([usdc, eur]); // Direct
      expect(paths).toContainEqual([usdc, xlm, eur]); // Via XLM
    });

    it('should generate double intermediary paths', () => {
      const paths = generatePossiblePaths(usdc, gbp, [xlm, eur], 4);
      
      expect(paths.length).toBeGreaterThan(3);
      expect(paths).toContainEqual([usdc, gbp]); // Direct
      expect(paths).toContainEqual([usdc, xlm, gbp]); // Via XLM
      expect(paths).toContainEqual([usdc, eur, gbp]); // Via EUR
      expect(paths).toContainEqual([usdc, xlm, eur, gbp]); // Via XLM then EUR
      expect(paths).toContainEqual([usdc, eur, xlm, gbp]); // Via EUR then XLM
    });

    it('should respect max path length', () => {
      const paths = generatePossiblePaths(usdc, gbp, [xlm, eur], 3);
      
      expect(paths.every(path => path.length <= 3)).toBe(true);
    });
  });

  describe('estimatePathPaymentFees', () => {
    it('should estimate fees for direct path', () => {
      const fees = estimatePathPaymentFees(2); // Direct path has 2 assets
      const feeAmount = parseFloat(fees);
      
      expect(feeAmount).toBeGreaterThan(0);
      expect(feeAmount).toBeLessThan(0.01); // Should be reasonable
    });

    it('should increase fees for longer paths', () => {
      const directFees = parseFloat(estimatePathPaymentFees(2));
      const longPathFees = parseFloat(estimatePathPaymentFees(4));
      
      expect(longPathFees).toBeGreaterThan(directFees);
    });
  });

  describe('calculatePathConfidence', () => {
    it('should calculate confidence score', () => {
      const path = [
        { code: 'USDC', issuer: 'GA5Z...', isNative: false },
        { code: 'XLM', issuer: null, isNative: true },
        { code: 'EUR', issuer: 'GCQT...', isNative: false },
      ];
      
      const confidence = calculatePathConfidence(
        path,
        ['10000', '50000'], // Good liquidity
        ['1000', '5000'],   // Good volume
        0.02,               // 2% slippage
        0.01                // 1% price impact
      );
      
      expect(confidence).toBeGreaterThan(0.5);
      expect(confidence).toBeLessThanOrEqual(1.0);
    });

    it('should penalize poor conditions', () => {
      const path = [
        { code: 'USDC', issuer: 'GA5Z...', isNative: false },
        { code: 'EUR', issuer: 'GCQT...', isNative: false },
      ];
      
      const confidence = calculatePathConfidence(
        path,
        ['100'],    // Low liquidity
        ['10'],     // Low volume
        0.15,       // 15% slippage
        0.12        // 12% price impact
      );
      
      expect(confidence).toBeLessThan(0.5);
    });
  });

  describe('sortPathsByOptimality', () => {
    it('should sort paths by optimality', () => {
      const paths: PathOption[] = [
        {
          path: ['USDC', 'EUR'],
          estimatedSourceAmount: '1000',
          estimatedDestinationAmount: '900',
          slippage: 0.1, // High slippage
          priceImpact: 0.05,
          fees: '5',
          feasible: true,
        },
        {
          path: ['USDC', 'XLM', 'EUR'],
          estimatedSourceAmount: '1000',
          estimatedDestinationAmount: '920',
          slippage: 0.02, // Low slippage
          priceImpact: 0.01, // Low price impact
          fees: '3',
          feasible: true,
        },
        {
          path: ['USDC', 'BROKEN', 'EUR'],
          estimatedSourceAmount: '1000',
          estimatedDestinationAmount: '0',
          slippage: 0,
          priceImpact: 0,
          fees: '0',
          feasible: false, // Infeasible
        },
      ];
      
      const sorted = sortPathsByOptimality(paths);
      
      expect(sorted[0].feasible).toBe(true);
      expect(sorted[1].feasible).toBe(true);
      expect(sorted[2].feasible).toBe(false);
      expect(sorted[0].slippage).toBeLessThan(sorted[1].slippage);
    });
  });

  describe('createMockLiquidityData', () => {
    it('should create realistic mock data', () => {
      const pools = createMockLiquidityData();
      
      expect(pools.length).toBeGreaterThan(0);
      
      pools.forEach(pool => {
        expect(pool.id).toBeDefined();
        expect(pool.assetA).toBeDefined();
        expect(pool.assetB).toBeDefined();
        expect(pool.reserves.assetA).toBeDefined();
        expect(pool.reserves.assetB).toBeDefined();
        expect(pool.fee).toBeGreaterThan(0);
        expect(pool.totalShares).toBeDefined();
      });
    });
  });

  describe('retryPathPaymentOperation', () => {
    it('should succeed on first attempt', async () => {
      const operation = vi.fn().mockResolvedValue('success');
      
      const result = await retryPathPaymentOperation(operation, 3, 100);
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValue('success');
      
      const result = await retryPathPaymentOperation(operation, 3, 50);
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should throw after max retries', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Persistent error'));
      
      await expect(
        retryPathPaymentOperation(operation, 2, 50)
      ).rejects.toThrow('Persistent error');
      
      expect(operation).toHaveBeenCalledTimes(2);
    });
  });
});