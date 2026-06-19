import { describe, it, expect, beforeEach, afterEach, vi, MockedFunction } from 'vitest';
import request from 'supertest';
import express from 'express';
import { PathPaymentController } from '../pathPaymentController.js';
import { PayrollPathPaymentService } from '../../services/payrollPathPaymentService.js';
import { AssetPathPaymentService } from '../../services/assetPathPaymentService.js';

// Mock services
vi.mock('../../services/payrollPathPaymentService.js', () => ({
  PayrollPathPaymentService: {
    configureOrganizationPathPayments: vi.fn(),
    getOrganizationPathConfig: vi.fn(),
    executePayrollWithPathPayments: vi.fn(),
    getPayrollRunStatus: vi.fn(),
    getEmployeePayments: vi.fn(),
    getOrganizationPayrollRuns: vi.fn(),
  },
}));

vi.mock('../../services/assetPathPaymentService.js', () => ({
  AssetPathPaymentService: {
    estimatePayrollPathCosts: vi.fn(),
    findOptimalPath: vi.fn(),
    getSupportedAssets: vi.fn(),
    getLiquidityPoolStats: vi.fn(),
  },
}));

vi.mock('../../utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('PathPaymentController', () => {
  let app: express.Application;
  const mockUser = {
    id: 1,
    organizationId: 1,
    role: 'admin',
  };

  beforeEach(() => {
    app = express();
    app.use(express.json());
    
    // Mock authentication middleware
    app.use((req: any, res, next) => {
      req.user = mockUser;
      next();
    });

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('POST /configure', () => {
    const validConfig = {
      employerAddress: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
      defaultSourceAsset: {
        code: 'USDC',
        issuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
      },
      maxSlippageBps: 500,
      maxPriceImpactBps: 1000,
      autoApproveThreshold: '10000',
      isActive: true,
    };

    it('should configure organization successfully', async () => {
      const mockConfigureOrganization = PayrollPathPaymentService.configureOrganizationPathPayments as MockedFunction<
        typeof PayrollPathPaymentService.configureOrganizationPathPayments
      >;
      mockConfigureOrganization.mockResolvedValueOnce(true);

      app.post('/configure', PathPaymentController.configureOrganization);

      const response = await request(app)
        .post('/configure')
        .send(validConfig)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Organization configured for path payment payrolls');
      expect(mockConfigureOrganization).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: mockUser.organizationId,
          employerAddress: validConfig.employerAddress,
          defaultSourceAsset: validConfig.defaultSourceAsset,
        })
      );
    });

    it('should return 400 for invalid employer address', async () => {
      app.post('/configure', PathPaymentController.configureOrganization);

      const invalidConfig = {
        ...validConfig,
        employerAddress: 'invalid-address',
      };

      const response = await request(app)
        .post('/configure')
        .send(invalidConfig)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toContainEqual(
        expect.objectContaining({
          msg: 'Employer address must be a valid Stellar public key',
        })
      );
    });

    it('should return 400 for invalid slippage values', async () => {
      app.post('/configure', PathPaymentController.configureOrganization);

      const invalidConfig = {
        ...validConfig,
        maxSlippageBps: 15000, // > 10000
      };

      const response = await request(app)
        .post('/configure')
        .send(invalidConfig)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toContainEqual(
        expect.objectContaining({
          msg: 'Max slippage must be between 0 and 10000 basis points',
        })
      );
    });

    it('should return 500 when configuration fails', async () => {
      const mockConfigureOrganization = PayrollPathPaymentService.configureOrganizationPathPayments as MockedFunction<
        typeof PayrollPathPaymentService.configureOrganizationPathPayments
      >;
      mockConfigureOrganization.mockResolvedValueOnce(false);

      app.post('/configure', PathPaymentController.configureOrganization);

      const response = await request(app)
        .post('/configure')
        .send(validConfig)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Failed to configure organization');
    });

    it('should return 401 when organization ID is missing', async () => {
      app.use((req: any, res, next) => {
        req.user = { id: 1 }; // No organizationId
        next();
      });
      app.post('/configure', PathPaymentController.configureOrganization);

      const response = await request(app)
        .post('/configure')
        .send(validConfig)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Organization ID required');
    });
  });

  describe('GET /config', () => {
    it('should return organization config successfully', async () => {
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

      const mockGetConfig = PayrollPathPaymentService.getOrganizationPathConfig as MockedFunction<
        typeof PayrollPathPaymentService.getOrganizationPathConfig
      >;
      mockGetConfig.mockResolvedValueOnce(mockConfig);

      app.get('/config', PathPaymentController.getOrganizationConfig);

      const response = await request(app)
        .get('/config')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.config).toEqual(mockConfig);
      expect(mockGetConfig).toHaveBeenCalledWith(mockUser.organizationId);
    });

    it('should return 404 when organization not configured', async () => {
      const mockGetConfig = PayrollPathPaymentService.getOrganizationPathConfig as MockedFunction<
        typeof PayrollPathPaymentService.getOrganizationPathConfig
      >;
      mockGetConfig.mockResolvedValueOnce(null);

      app.get('/config', PathPaymentController.getOrganizationConfig);

      const response = await request(app)
        .get('/config')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Organization not configured for path payments');
    });
  });

  describe('POST /payroll/execute', () => {
    const validPayrollRequest = {
      employees: [
        {
          employeeId: 1,
          employeeAddress: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
          destinationAsset: {
            code: 'EUR',
            issuer: 'GCQTOZ3ISCHKXQ7DWKFVGEG5DTHBZ4QY24FWGHQG6GQJYU62JFGR4PHT',
          },
          destinationAmount: '1000',
        },
        {
          employeeId: 2,
          employeeAddress: 'GCKFBEIYTKP2Q3K7VDEGBJ76MN3QGCWTXPC3U3YDAG5FGABUO3DDSC2V',
          destinationAsset: {
            code: 'GBP',
            issuer: 'GCURWNKH7JMLY23X3OQZDY6NEZPBDY6QPGNEEDC4H7F5LYCX4PIED7WJ',
          },
          destinationAmount: '800',
        },
      ],
      paymentType: 'strict_send',
    };

    it('should execute payroll successfully', async () => {
      const mockExecuteResult = {
        success: true,
        runId: 'run-123',
        contractRunId: 1,
        totalEmployees: 2,
        successfulPayments: 2,
        failedPayments: 0,
        totalSourceAmount: '2000',
        totalDestinationAmount: '1800',
        errors: [],
      };

      const mockExecute = PayrollPathPaymentService.executePayrollWithPathPayments as MockedFunction<
        typeof PayrollPathPaymentService.executePayrollWithPathPayments
      >;
      mockExecute.mockResolvedValueOnce(mockExecuteResult);

      app.post('/payroll/execute', PathPaymentController.executePayrollRun);

      const response = await request(app)
        .post('/payroll/execute')
        .send(validPayrollRequest)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.runId).toBe('run-123');
      expect(response.body.successfulPayments).toBe(2);
      expect(mockExecute).toHaveBeenCalledWith(
        mockUser.organizationId,
        expect.arrayContaining([
          expect.objectContaining({
            employeeId: 1,
            employeeAddress: validPayrollRequest.employees[0].employeeAddress,
          }),
        ]),
        'strict_send'
      );
    });

    it('should return 400 for invalid employee data', async () => {
      app.post('/payroll/execute', PathPaymentController.executePayrollRun);

      const invalidRequest = {
        employees: [
          {
            employeeId: 'invalid', // Should be integer
            employeeAddress: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
            destinationAsset: {
              code: 'EUR',
              issuer: 'GCQTOZ3ISCHKXQ7DWKFVGEG5DTHBZ4QY24FWGHQG6GQJYU62JFGR4PHT',
            },
            destinationAmount: '1000',
          },
        ],
      };

      const response = await request(app)
        .post('/payroll/execute')
        .send(invalidRequest)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
    });

    it('should return 400 for too many employees', async () => {
      app.post('/payroll/execute', PathPaymentController.executePayrollRun);

      const tooManyEmployees = {
        employees: Array(101).fill(validPayrollRequest.employees[0]), // > 100 limit
      };

      const response = await request(app)
        .post('/payroll/execute')
        .send(tooManyEmployees)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toContainEqual(
        expect.objectContaining({
          msg: 'Employees array must contain 1-100 items',
        })
      );
    });

    it('should use default payment type when not specified', async () => {
      const mockExecute = PayrollPathPaymentService.executePayrollWithPathPayments as MockedFunction<
        typeof PayrollPathPaymentService.executePayrollWithPathPayments
      >;
      mockExecute.mockResolvedValueOnce({
        success: true,
        runId: 'run-123',
        totalEmployees: 2,
        successfulPayments: 2,
        failedPayments: 0,
        errors: [],
      });

      app.post('/payroll/execute', PathPaymentController.executePayrollRun);

      const requestWithoutType = {
        employees: validPayrollRequest.employees,
      };

      await request(app)
        .post('/payroll/execute')
        .send(requestWithoutType)
        .expect(200);

      expect(mockExecute).toHaveBeenCalledWith(
        expect.any(Number),
        expect.any(Array),
        'strict_send' // Default value
      );
    });
  });

  describe('GET /payroll/runs/:runId', () => {
    const mockPayrollRun = {
      id: 'run-123',
      organizationId: 1,
      employerAddress: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
      sourceAsset: {
        code: 'USDC',
        issuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
        isNative: false,
      },
      paymentType: 'strict_send' as const,
      totalEmployees: 2,
      successfulPayments: 2,
      failedPayments: 0,
      status: 'completed' as const,
      createdAt: new Date(),
    };

    const mockEmployeePayments = [
      {
        id: 'payment-1',
        payrollRunId: 'run-123',
        employeeId: 1,
        employeeAddress: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
        sourceAsset: {
          code: 'USDC',
          issuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
          isNative: false,
        },
        destinationAsset: {
          code: 'EUR',
          issuer: 'GCQTOZ3ISCHKXQ7DWKFVGEG5DTHBZ4QY24FWGHQG6GQJYU62JFGR4PHT',
          isNative: false,
        },
        destinationAmount: '1000',
        status: 'completed' as const,
        createdAt: new Date(),
      },
    ];

    it('should return payroll run status successfully', async () => {
      const mockGetStatus = PayrollPathPaymentService.getPayrollRunStatus as MockedFunction<
        typeof PayrollPathPaymentService.getPayrollRunStatus
      >;
      const mockGetEmployees = PayrollPathPaymentService.getEmployeePayments as MockedFunction<
        typeof PayrollPathPaymentService.getEmployeePayments
      >;

      mockGetStatus.mockResolvedValueOnce(mockPayrollRun);
      mockGetEmployees.mockResolvedValueOnce(mockEmployeePayments);

      app.get('/payroll/runs/:runId', PathPaymentController.getPayrollRunStatus);

      const response = await request(app)
        .get('/payroll/runs/550e8400-e29b-41d4-a716-446655440000')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.payrollRun).toEqual(mockPayrollRun);
      expect(response.body.employeePayments).toEqual(mockEmployeePayments);
    });

    it('should return 404 when payroll run not found', async () => {
      const mockGetStatus = PayrollPathPaymentService.getPayrollRunStatus as MockedFunction<
        typeof PayrollPathPaymentService.getPayrollRunStatus
      >;
      mockGetStatus.mockResolvedValueOnce(null);

      app.get('/payroll/runs/:runId', PathPaymentController.getPayrollRunStatus);

      const response = await request(app)
        .get('/payroll/runs/550e8400-e29b-41d4-a716-446655440000')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Payroll run not found');
    });

    it('should return 400 for invalid UUID format', async () => {
      app.get('/payroll/runs/:runId', PathPaymentController.getPayrollRunStatus);

      const response = await request(app)
        .get('/payroll/runs/invalid-uuid')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toContainEqual(
        expect.objectContaining({
          msg: 'Run ID must be a valid UUID',
        })
      );
    });

    it('should return 403 when user does not have access to organization', async () => {
      const otherOrgRun = {
        ...mockPayrollRun,
        organizationId: 999, // Different organization
      };

      const mockGetStatus = PayrollPathPaymentService.getPayrollRunStatus as MockedFunction<
        typeof PayrollPathPaymentService.getPayrollRunStatus
      >;
      mockGetStatus.mockResolvedValueOnce(otherOrgRun);

      app.get('/payroll/runs/:runId', PathPaymentController.getPayrollRunStatus);

      const response = await request(app)
        .get('/payroll/runs/550e8400-e29b-41d4-a716-446655440000')
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Access denied');
    });
  });

  describe('GET /payroll/runs', () => {
    it('should return organization payroll runs with default pagination', async () => {
      const mockRuns = [
        {
          id: 'run-1',
          organizationId: 1,
          employerAddress: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
          sourceAsset: {
            code: 'USDC',
            issuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
            isNative: false,
          },
          paymentType: 'strict_send' as const,
          totalEmployees: 2,
          successfulPayments: 2,
          failedPayments: 0,
          status: 'completed' as const,
          createdAt: new Date(),
        },
      ];

      const mockGetRuns = PayrollPathPaymentService.getOrganizationPayrollRuns as MockedFunction<
        typeof PayrollPathPaymentService.getOrganizationPayrollRuns
      >;
      mockGetRuns.mockResolvedValueOnce(mockRuns);

      app.get('/payroll/runs', PathPaymentController.getPayrollRunsHistory);

      const response = await request(app)
        .get('/payroll/runs')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.payrollRuns).toEqual(mockRuns);
      expect(response.body.pagination).toEqual({
        limit: 50,
        offset: 0,
        total: mockRuns.length,
      });
      expect(mockGetRuns).toHaveBeenCalledWith(mockUser.organizationId, 50, 0);
    });

    it('should respect custom pagination parameters', async () => {
      const mockGetRuns = PayrollPathPaymentService.getOrganizationPayrollRuns as MockedFunction<
        typeof PayrollPathPaymentService.getOrganizationPayrollRuns
      >;
      mockGetRuns.mockResolvedValueOnce([]);

      app.get('/payroll/runs', PathPaymentController.getPayrollRunsHistory);

      await request(app)
        .get('/payroll/runs?limit=10&offset=20')
        .expect(200);

      expect(mockGetRuns).toHaveBeenCalledWith(mockUser.organizationId, 10, 20);
    });

    it('should return 400 for invalid pagination parameters', async () => {
      app.get('/payroll/runs', PathPaymentController.getPayrollRunsHistory);

      const response = await request(app)
        .get('/payroll/runs?limit=200') // > 100 max
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toContainEqual(
        expect.objectContaining({
          msg: 'Limit must be between 1 and 100',
        })
      );
    });
  });

  describe('POST /payroll/estimate', () => {
    const validEstimateRequest = {
      sourceAsset: {
        code: 'USDC',
        issuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
      },
      employees: [
        {
          destinationAsset: {
            code: 'EUR',
            issuer: 'GCQTOZ3ISCHKXQ7DWKFVGEG5DTHBZ4QY24FWGHQG6GQJYU62JFGR4PHT',
          },
          destinationAmount: '1000',
        },
      ],
      paymentType: 'strict_send',
    };

    it('should return cost estimate successfully', async () => {
      const mockEstimate = {
        totalEstimatedSourceCost: '1050',
        totalDestinationAmount: '1000',
        averageSlippage: 0.02,
        averagePriceImpact: 0.05,
        feasibleEmployees: 1,
        infeasibleEmployees: [],
      };

      const mockEstimateCosts = AssetPathPaymentService.estimatePayrollPathCosts as MockedFunction<
        typeof AssetPathPaymentService.estimatePayrollPathCosts
      >;
      mockEstimateCosts.mockResolvedValueOnce(mockEstimate);

      app.post('/payroll/estimate', PathPaymentController.estimatePayrollCosts);

      const response = await request(app)
        .post('/payroll/estimate')
        .send(validEstimateRequest)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.estimate.totalEstimatedSourceCost).toBe('1050');
      expect(response.body.estimate.feasibilityRate).toBe(1); // 1/1 employees feasible
    });

    it('should return 400 for invalid source asset', async () => {
      app.post('/payroll/estimate', PathPaymentController.estimatePayrollCosts);

      const invalidRequest = {
        ...validEstimateRequest,
        sourceAsset: {
          code: '', // Empty code
        },
      };

      const response = await request(app)
        .post('/payroll/estimate')
        .send(invalidRequest)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
    });
  });

  describe('POST /paths/find', () => {
    const validPathRequest = {
      sourceAsset: {
        code: 'USDC',
        issuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
      },
      destinationAsset: {
        code: 'EUR',
        issuer: 'GCQTOZ3ISCHKXQ7DWKFVGEG5DTHBZ4QY24FWGHQG6GQJYU62JFGR4PHT',
      },
      amount: '1000',
      amountType: 'source',
    };

    it('should find optimal paths successfully', async () => {
      const mockPaths = [
        {
          path: ['USDC', 'XLM', 'EUR'],
          estimatedSourceAmount: '1000',
          estimatedDestinationAmount: '850',
          slippage: 0.02,
          priceImpact: 0.05,
          optimal: true,
        },
      ];

      const mockFindPaths = AssetPathPaymentService.findOptimalPath as MockedFunction<
        typeof AssetPathPaymentService.findOptimalPath
      >;
      mockFindPaths.mockResolvedValueOnce(mockPaths);

      app.post('/paths/find', PathPaymentController.findOptimalPaths);

      const response = await request(app)
        .post('/paths/find')
        .send(validPathRequest)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.paths).toEqual(mockPaths);
      expect(response.body.totalPaths).toBe(1);
      expect(response.body.optimalPath).toEqual(mockPaths[0]);
    });

    it('should return 400 for invalid amount type', async () => {
      app.post('/paths/find', PathPaymentController.findOptimalPaths);

      const invalidRequest = {
        ...validPathRequest,
        amountType: 'invalid',
      };

      const response = await request(app)
        .post('/paths/find')
        .send(invalidRequest)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toContainEqual(
        expect.objectContaining({
          msg: 'Amount type must be source or destination',
        })
      );
    });
  });

  describe('GET /assets', () => {
    it('should return supported assets successfully', async () => {
      const mockAssets = [
        {
          code: 'XLM',
          issuer: null,
          isNative: true,
        },
        {
          code: 'USDC',
          issuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
          isNative: false,
        },
      ];

      const mockGetAssets = AssetPathPaymentService.getSupportedAssets as MockedFunction<
        typeof AssetPathPaymentService.getSupportedAssets
      >;
      mockGetAssets.mockResolvedValueOnce(mockAssets);

      app.get('/assets', PathPaymentController.getSupportedAssets);

      const response = await request(app)
        .get('/assets')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.assets).toEqual(mockAssets);
      expect(response.body.totalAssets).toBe(2);
    });
  });

  describe('GET /liquidity/stats', () => {
    it('should return liquidity pool stats successfully', async () => {
      const mockStats = {
        totalPools: 10,
        totalLiquidity: '1000000',
        averageSpread: 0.003,
        topPools: [
          {
            assets: ['XLM', 'USDC'],
            liquidity: '500000',
            volume24h: '100000',
          },
        ],
      };

      const mockGetStats = AssetPathPaymentService.getLiquidityPoolStats as MockedFunction<
        typeof AssetPathPaymentService.getLiquidityPoolStats
      >;
      mockGetStats.mockResolvedValueOnce(mockStats);

      app.get('/liquidity/stats', PathPaymentController.getLiquidityPoolStats);

      const response = await request(app)
        .get('/liquidity/stats')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.stats).toEqual(mockStats);
    });
  });
});