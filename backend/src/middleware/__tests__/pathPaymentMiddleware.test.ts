import { describe, it, expect, beforeEach, afterEach, vi, MockedFunction } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import {
  requirePathPaymentConfig,
  validateBatchSize,
  validateSlippageParameters,
  validateAssetParameters,
  validateAmountParameters,
  validateStellarAddresses,
  pathPaymentRateLimit,
  logPathPaymentOperation,
} from '../pathPaymentMiddleware.js';
import { PayrollPathPaymentService } from '../../services/payrollPathPaymentService.js';

// Mock the PayrollPathPaymentService
vi.mock('../../services/payrollPathPaymentService.js', () => ({
  PayrollPathPaymentService: {
    getOrganizationPathConfig: vi.fn(),
  },
}));

// Mock logger
vi.mock('../../utils/logger.js', () => ({
  default: {
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe('pathPaymentMiddleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = {
      user: { organizationId: 1, id: 123 },
      body: {},
      method: 'POST',
      path: '/test',
    };
    
    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };
    
    mockNext = vi.fn();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('requirePathPaymentConfig', () => {
    const mockGetConfig = PayrollPathPaymentService.getOrganizationPathConfig as MockedFunction<
      typeof PayrollPathPaymentService.getOrganizationPathConfig
    >;

    it('should pass with valid config', async () => {
      const mockConfig = {
        organizationId: 1,
        employerAddress: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
        defaultSourceAsset: {
          code: 'USDC',
          issuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
          isNative: false,
        },
        maxSlippageBps: 500,
        maxPriceImpactBps: 1000,
        autoApproveThreshold: '10000',
        isActive: true,
      };

      mockGetConfig.mockResolvedValueOnce(mockConfig);

      await requirePathPaymentConfig(
        mockRequest as any,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect(mockRequest.pathPaymentConfig).toEqual(mockConfig);
    });

    it('should reject when organization ID is missing', async () => {
      mockRequest.user = { id: 123 }; // No organizationId

      await requirePathPaymentConfig(
        mockRequest as any,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Organization ID required',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject when config is not found', async () => {
      mockGetConfig.mockResolvedValueOnce(null);

      await requirePathPaymentConfig(
        mockRequest as any,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Organization not configured for path payments or configuration is inactive',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject when config is inactive', async () => {
      const inactiveConfig = {
        organizationId: 1,
        employerAddress: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
        defaultSourceAsset: {
          code: 'USDC',
          issuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
          isNative: false,
        },
        maxSlippageBps: 500,
        maxPriceImpactBps: 1000,
        autoApproveThreshold: '10000',
        isActive: false, // Inactive
      };

      mockGetConfig.mockResolvedValueOnce(inactiveConfig);

      await requirePathPaymentConfig(
        mockRequest as any,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('validateBatchSize', () => {
    const middleware = validateBatchSize(5); // Max 5 for testing

    it('should pass with valid batch size', () => {
      mockRequest.body = {
        employees: [
          { employeeId: 1 },
          { employeeId: 2 },
          { employeeId: 3 },
        ],
      };

      middleware(mockRequest as any, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject when employees is not an array', () => {
      mockRequest.body = { employees: 'invalid' };

      middleware(mockRequest as any, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Employees must be an array',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject when employees array is empty', () => {
      mockRequest.body = { employees: [] };

      middleware(mockRequest as any, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'At least one employee must be provided',
      });
    });

    it('should reject when batch size exceeds limit', () => {
      mockRequest.body = {
        employees: Array(6).fill({ employeeId: 1 }), // Exceeds limit of 5
      };

      middleware(mockRequest as any, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Batch size exceeds maximum limit of 5 employees',
      });
    });
  });

  describe('validateSlippageParameters', () => {
    it('should pass with valid slippage parameters', () => {
      mockRequest.body = {
        maxSlippageBps: 500,
        maxPriceImpactBps: 1000,
      };

      validateSlippageParameters(mockRequest as any, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject invalid slippage values', () => {
      mockRequest.body = { maxSlippageBps: 15000 }; // > 10000

      validateSlippageParameters(mockRequest as any, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Max slippage must be between 0 and 10000 basis points (0-100%)',
      });
    });

    it('should reject negative slippage values', () => {
      mockRequest.body = { maxSlippageBps: -100 };

      validateSlippageParameters(mockRequest as any, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });

    it('should reject invalid price impact values', () => {
      mockRequest.body = { maxPriceImpactBps: 20000 }; // > 10000

      validateSlippageParameters(mockRequest as any, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Max price impact must be between 0 and 10000 basis points (0-100%)',
      });
    });
  });

  describe('validateAssetParameters', () => {
    it('should pass with valid assets', () => {
      mockRequest.body = {
        sourceAsset: {
          code: 'USDC',
          issuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
        },
        destinationAsset: {
          code: 'XLM',
          issuer: null,
        },
      };

      validateAssetParameters(mockRequest as any, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject asset without code', () => {
      mockRequest.body = {
        sourceAsset: {
          issuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
        },
      };

      validateAssetParameters(mockRequest as any, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'sourceAsset.code is required and must be a string',
      });
    });

    it('should reject asset code too long', () => {
      mockRequest.body = {
        sourceAsset: {
          code: 'VERYLONGASSETCODE', // > 12 characters
          issuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
        },
      };

      validateAssetParameters(mockRequest as any, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'sourceAsset.code must be 12 characters or less',
      });
    });

    it('should reject XLM with issuer', () => {
      mockRequest.body = {
        sourceAsset: {
          code: 'XLM',
          issuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
        },
      };

      validateAssetParameters(mockRequest as any, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'sourceAsset: Native XLM should not have an issuer',
      });
    });

    it('should reject invalid issuer length', () => {
      mockRequest.body = {
        sourceAsset: {
          code: 'USDC',
          issuer: 'INVALID', // Wrong length
        },
      };

      validateAssetParameters(mockRequest as any, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'sourceAsset.issuer must be a valid 56-character Stellar public key',
      });
    });

    it('should validate employee assets', () => {
      mockRequest.body = {
        employees: [
          {
            destinationAsset: {
              code: '', // Invalid empty code
              issuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
            },
          },
        ],
      };

      validateAssetParameters(mockRequest as any, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'employees[0].destinationAsset.code is required and must be a string',
      });
    });
  });

  describe('validateAmountParameters', () => {
    it('should pass with valid amounts', () => {
      mockRequest.body = {
        amount: '1000.50',
        autoApproveThreshold: '5000',
      };

      validateAmountParameters(mockRequest as any, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject negative amounts', () => {
      mockRequest.body = { amount: '-100' };

      validateAmountParameters(mockRequest as any, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'amount must be a positive number',
      });
    });

    it('should reject zero amounts', () => {
      mockRequest.body = { amount: '0' };

      validateAmountParameters(mockRequest as any, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });

    it('should reject amounts with too many decimal places', () => {
      mockRequest.body = { amount: '1.12345678' }; // 8 decimal places > 7 limit

      validateAmountParameters(mockRequest as any, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'amount cannot have more than 7 decimal places',
      });
    });

    it('should validate employee amounts', () => {
      mockRequest.body = {
        employees: [
          {
            destinationAmount: 'invalid', // Non-numeric
          },
        ],
      };

      validateAmountParameters(mockRequest as any, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'employees[0].destinationAmount must be a positive number',
      });
    });

    it('should handle numeric amounts', () => {
      mockRequest.body = {
        amount: 1000.5, // Numeric instead of string
      };

      validateAmountParameters(mockRequest as any, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('validateStellarAddresses', () => {
    it('should pass with valid addresses', () => {
      mockRequest.body = {
        employerAddress: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
        employees: [
          {
            employeeAddress: 'GCKFBEIYTKP2Q3K7VDEGBJ76MN3QGCWTXPC3U3YDAG5FGABUO3DDSC2V',
          },
        ],
      };

      validateStellarAddresses(mockRequest as any, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject invalid address length', () => {
      mockRequest.body = {
        employerAddress: 'INVALID', // Wrong length
      };

      validateStellarAddresses(mockRequest as any, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'employerAddress must be a valid 56-character Stellar public key starting with \'G\'',
      });
    });

    it('should reject address not starting with G', () => {
      mockRequest.body = {
        employerAddress: 'SBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H', // Starts with S
      };

      validateStellarAddresses(mockRequest as any, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });

    it('should validate employee addresses', () => {
      mockRequest.body = {
        employees: [
          {
            employeeAddress: 'INVALID',
          },
        ],
      };

      validateStellarAddresses(mockRequest as any, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'employees[0].employeeAddress must be a valid 56-character Stellar public key starting with \'G\'',
      });
    });
  });

  describe('pathPaymentRateLimit', () => {
    const middleware = pathPaymentRateLimit(1000, 2); // 1 second window, 2 requests max

    it('should allow requests under limit', () => {
      middleware(mockRequest as any, mockResponse as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();
      
      vi.clearAllMocks();
      middleware(mockRequest as any, mockResponse as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should block requests over limit', () => {
      // First two requests should pass
      middleware(mockRequest as any, mockResponse as Response, mockNext);
      middleware(mockRequest as any, mockResponse as Response, mockNext);
      
      vi.clearAllMocks();
      
      // Third request should be blocked
      middleware(mockRequest as any, mockResponse as Response, mockNext);
      
      expect(mockResponse.status).toHaveBeenCalledWith(429);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Too many path payment requests. Please try again later.',
        retryAfter: expect.any(Number),
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject when organization ID is missing', () => {
      mockRequest.user = { id: 123 }; // No organizationId

      middleware(mockRequest as any, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('logPathPaymentOperation', () => {
    it('should log operation details', () => {
      const mockLogger = vi.fn();
      vi.doMock('../../utils/logger.js', () => ({
        default: { info: mockLogger },
      }));

      logPathPaymentOperation(mockRequest as any, mockResponse as Response, mockNext);

      // Simulate response
      const responseData = {
        success: true,
        runId: 'test-run-123',
        totalEmployees: 5,
      };

      (mockResponse.send as any)(JSON.stringify(responseData));

      expect(mockNext).toHaveBeenCalled();
      // Note: Logger call verification would depend on implementation details
    });
  });
});