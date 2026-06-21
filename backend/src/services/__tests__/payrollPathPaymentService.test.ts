import { describe, it, expect, beforeEach, afterEach, vi, MockedFunction } from 'vitest';
import { PayrollPathPaymentService, PayrollPathConfiguration } from '../payrollPathPaymentService.js';
import { AssetPathPaymentService } from '../assetPathPaymentService.js';
import { pool } from '../../config/database.js';
import logger from '../../utils/logger.js';

// Mock dependencies
vi.mock('../../config/database.js', () => ({
  pool: {
    query: vi.fn(),
  },
}));

vi.mock('../assetPathPaymentService.js', () => ({
  AssetPathPaymentService: {
    configureEmployerPathPayments: vi.fn(),
    estimatePayrollPathCosts: vi.fn(),
    executePayrollPathPayments: vi.fn(),
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

describe('PayrollPathPaymentService', () => {
  const mockQuery = pool.query as MockedFunction<typeof pool.query>;
  const mockConfigureEmployer = AssetPathPaymentService.configureEmployerPathPayments as MockedFunction<
    typeof AssetPathPaymentService.configureEmployerPathPayments
  >;
  const mockEstimateCosts = AssetPathPaymentService.estimatePayrollPathCosts as MockedFunction<
    typeof AssetPathPaymentService.estimatePayrollPathCosts
  >;
  const mockExecutePayroll = AssetPathPaymentService.executePayrollPathPayments as MockedFunction<
    typeof AssetPathPaymentService.executePayrollPathPayments
  >;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('configureOrganizationPathPayments', () => {
    const mockConfig: PayrollPathConfiguration = {
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

    it('should configure organization successfully', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 1 }],
      } as any);
      mockConfigureEmployer.mockResolvedValueOnce(true);

      const result = await PayrollPathPaymentService.configureOrganizationPathPayments(mockConfig);

      expect(result).toBe(true);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO payroll_path_configs'),
        expect.arrayContaining([
          mockConfig.organizationId,
          mockConfig.employerAddress,
          mockConfig.defaultSourceAsset.code,
          mockConfig.defaultSourceAsset.issuer,
          mockConfig.maxSlippageBps,
          mockConfig.maxPriceImpactBps,
          mockConfig.autoApproveThreshold,
          mockConfig.isActive,
        ])
      );
      expect(mockConfigureEmployer).toHaveBeenCalledWith(
        expect.objectContaining({
          employerAddress: mockConfig.employerAddress,
          defaultSourceAsset: mockConfig.defaultSourceAsset,
        })
      );
    });

    it('should handle contract configuration failure', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 1 }],
      } as any);
      mockConfigureEmployer.mockResolvedValueOnce(false);

      const result = await PayrollPathPaymentService.configureOrganizationPathPayments(mockConfig);

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to configure employer in Soroban contract',
        expect.any(Object)
      );
    });

    it('should handle database errors', async () => {
      const dbError = new Error('Database connection failed');
      mockQuery.mockRejectedValueOnce(dbError);

      const result = await PayrollPathPaymentService.configureOrganizationPathPayments(mockConfig);

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to configure organization for path payments',
        expect.objectContaining({ error: dbError })
      );
    });
  });

  describe('getOrganizationPathConfig', () => {
    const mockDbRow = {
      organization_id: 1,
      employer_address: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
      default_source_asset_code: 'USDC',
      default_source_asset_issuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
      max_slippage_bps: 500,
      max_price_impact_bps: 1000,
      auto_approve_threshold: '10000',
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    };

    it('should return organization config when found', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [mockDbRow],
      } as any);

      const result = await PayrollPathPaymentService.getOrganizationPathConfig(1);

      expect(result).toEqual({
        organizationId: mockDbRow.organization_id,
        employerAddress: mockDbRow.employer_address,
        defaultSourceAsset: {
          code: mockDbRow.default_source_asset_code,
          issuer: mockDbRow.default_source_asset_issuer,
          isNative: false,
        },
        maxSlippageBps: mockDbRow.max_slippage_bps,
        maxPriceImpactBps: mockDbRow.max_price_impact_bps,
        autoApproveThreshold: mockDbRow.auto_approve_threshold,
        isActive: mockDbRow.is_active,
        createdAt: mockDbRow.created_at,
        updatedAt: mockDbRow.updated_at,
      });
    });

    it('should return null when organization not found', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [],
      } as any);

      const result = await PayrollPathPaymentService.getOrganizationPathConfig(999);

      expect(result).toBeNull();
    });

    it('should handle native XLM assets correctly', async () => {
      const xlmRow = {
        ...mockDbRow,
        default_source_asset_code: 'XLM',
        default_source_asset_issuer: null,
      };

      mockQuery.mockResolvedValueOnce({
        rows: [xlmRow],
      } as any);

      const result = await PayrollPathPaymentService.getOrganizationPathConfig(1);

      expect(result?.defaultSourceAsset).toEqual({
        code: 'XLM',
        issuer: null,
        isNative: true,
      });
    });
  });

  describe('executePayrollWithPathPayments', () => {
    const mockEmployeePayments = [
      {
        employeeId: 1,
        employeeAddress: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
        destinationAsset: {
          code: 'EUR',
          issuer: 'GCQTOZ3ISCHKXQ7DWKFVGEG5DTHBZ4QY24FWGHQG6GQJYU62JFGR4PHT',
          isNative: false,
        },
        destinationAmount: '1000',
      },
      {
        employeeId: 2,
        employeeAddress: 'GCKFBEIYTKP2Q3K7VDEGBJ76MN3QGCWTXPC3U3YDAG5FGABUO3DDSC2V',
        destinationAsset: {
          code: 'GBP',
          issuer: 'GCURWNKH7JMLY23X3OQZDY6NEZPBDY6QPGNEEDC4H7F5LYCX4PIED7WJ',
          isNative: false,
        },
        destinationAmount: '800',
      },
    ];

    const mockConfig: PayrollPathConfiguration = {
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

    it('should execute payroll successfully', async () => {
      // Mock getOrganizationPathConfig
      vi.spyOn(PayrollPathPaymentService, 'getOrganizationPathConfig').mockResolvedValueOnce(mockConfig);

      // Mock database operations
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: 'run-123' }] }) // Create payroll run
        .mockResolvedValueOnce({ rows: [] }) // Employee payment inserts (multiple calls)
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] }) // Update run status
        .mockResolvedValueOnce({ rows: [] }); // Final update

      // Mock cost estimation
      mockEstimateCosts.mockResolvedValueOnce({
        totalEstimatedSourceCost: '2000',
        totalDestinationAmount: '1800',
        averageSlippage: 0.02,
        averagePriceImpact: 0.05,
        feasibleEmployees: 2,
        infeasibleEmployees: [],
      });

      // Mock payroll execution
      mockExecutePayroll.mockResolvedValueOnce({
        success: true,
        totalEmployees: 2,
        successfulPayments: 2,
        failedPayments: 0,
        contractRunId: 1,
        totalSourceAmount: '1950',
        totalDestinationAmount: '1800',
        errors: [],
      });

      const result = await PayrollPathPaymentService.executePayrollWithPathPayments(
        1,
        mockEmployeePayments,
        'strict_send'
      );

      expect(result.success).toBe(true);
      expect(result.runId).toBe('run-123');
      expect(result.successfulPayments).toBe(2);
      expect(result.failedPayments).toBe(0);
    });

    it('should handle inactive organization', async () => {
      const inactiveConfig = { ...mockConfig, isActive: false };
      vi.spyOn(PayrollPathPaymentService, 'getOrganizationPathConfig').mockResolvedValueOnce(inactiveConfig);

      const result = await PayrollPathPaymentService.executePayrollWithPathPayments(
        1,
        mockEmployeePayments,
        'strict_send'
      );

      expect(result.success).toBe(false);
      expect(result.errors[0].error).toContain('not configured for path payments');
    });

    it('should handle organization not configured', async () => {
      vi.spyOn(PayrollPathPaymentService, 'getOrganizationPathConfig').mockResolvedValueOnce(null);

      const result = await PayrollPathPaymentService.executePayrollWithPathPayments(
        1,
        mockEmployeePayments,
        'strict_send'
      );

      expect(result.success).toBe(false);
      expect(result.errors[0].error).toContain('not configured for path payments');
    });

    it('should handle infeasible employees', async () => {
      vi.spyOn(PayrollPathPaymentService, 'getOrganizationPathConfig').mockResolvedValueOnce(mockConfig);

      mockQuery.mockResolvedValueOnce({ rows: [{ id: 'run-123' }] });

      // Mock cost estimation with infeasible employees
      mockEstimateCosts.mockResolvedValueOnce({
        totalEstimatedSourceCost: '1000',
        totalDestinationAmount: '1000',
        averageSlippage: 0.02,
        averagePriceImpact: 0.05,
        feasibleEmployees: 1,
        infeasibleEmployees: [{ index: 1, reason: 'No liquidity' }],
      });

      const result = await PayrollPathPaymentService.executePayrollWithPathPayments(
        1,
        mockEmployeePayments,
        'strict_send'
      );

      expect(result.success).toBe(false);
      expect(result.errors[0].error).toContain('No feasible employee payments found');
    });

    it('should handle strict_receive payment type', async () => {
      vi.spyOn(PayrollPathPaymentService, 'getOrganizationPathConfig').mockResolvedValueOnce(mockConfig);

      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: 'run-123' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      mockEstimateCosts.mockResolvedValueOnce({
        totalEstimatedSourceCost: '2000',
        totalDestinationAmount: '1800',
        averageSlippage: 0.02,
        averagePriceImpact: 0.05,
        feasibleEmployees: 2,
        infeasibleEmployees: [],
      });

      mockExecutePayroll.mockResolvedValueOnce({
        success: true,
        totalEmployees: 2,
        successfulPayments: 2,
        failedPayments: 0,
        contractRunId: 1,
        totalSourceAmount: '1950',
        totalDestinationAmount: '1800',
        errors: [],
      });

      const result = await PayrollPathPaymentService.executePayrollWithPathPayments(
        1,
        mockEmployeePayments,
        'strict_receive'
      );

      expect(result.success).toBe(true);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO payroll_path_runs'),
        expect.arrayContaining(['strict_receive'])
      );
    });
  });

  describe('getPayrollRunStatus', () => {
    const mockRunRow = {
      id: 'run-123',
      organization_id: 1,
      employer_address: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
      source_asset_code: 'USDC',
      source_asset_issuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
      payment_type: 'strict_send',
      total_employees: 2,
      successful_payments: 2,
      failed_payments: 0,
      total_source_amount: '2000',
      total_dest_amount: '1800',
      status: 'completed',
      contract_run_id: 1,
      created_at: new Date(),
      completed_at: new Date(),
      error_message: null,
    };

    it('should return payroll run status', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [mockRunRow],
      } as any);

      const result = await PayrollPathPaymentService.getPayrollRunStatus('run-123');

      expect(result).toEqual({
        id: mockRunRow.id,
        organizationId: mockRunRow.organization_id,
        employerAddress: mockRunRow.employer_address,
        sourceAsset: {
          code: mockRunRow.source_asset_code,
          issuer: mockRunRow.source_asset_issuer,
          isNative: false,
        },
        paymentType: mockRunRow.payment_type,
        totalEmployees: mockRunRow.total_employees,
        successfulPayments: mockRunRow.successful_payments,
        failedPayments: mockRunRow.failed_payments,
        totalSourceAmount: mockRunRow.total_source_amount,
        totalDestinationAmount: mockRunRow.total_dest_amount,
        status: mockRunRow.status,
        contractRunId: mockRunRow.contract_run_id,
        createdAt: mockRunRow.created_at,
        completedAt: mockRunRow.completed_at,
        errorMessage: mockRunRow.error_message,
      });
    });

    it('should return null when run not found', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [],
      } as any);

      const result = await PayrollPathPaymentService.getPayrollRunStatus('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getEmployeePayments', () => {
    const mockEmployeeRows = [
      {
        id: 'payment-1',
        payroll_run_id: 'run-123',
        employee_id: 1,
        employee_address: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
        source_asset_code: 'USDC',
        source_asset_issuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
        dest_asset_code: 'EUR',
        dest_asset_issuer: 'GCQTOZ3ISCHKXQ7DWKFVGEG5DTHBZ4QY24FWGHQG6GQJYU62JFGR4PHT',
        dest_amount: '1000',
        max_source_amount: '1100',
        min_dest_amount: '950',
        actual_source_amount: '1050',
        actual_dest_amount: '980',
        status: 'completed',
        tx_hash: 'abc123',
        error_message: null,
        slippage: 0.02,
        price_impact: 0.05,
        created_at: new Date(),
        processed_at: new Date(),
      },
    ];

    it('should return employee payments', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: mockEmployeeRows,
      } as any);

      const result = await PayrollPathPaymentService.getEmployeePayments('run-123');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: mockEmployeeRows[0].id,
        payrollRunId: mockEmployeeRows[0].payroll_run_id,
        employeeId: mockEmployeeRows[0].employee_id,
        employeeAddress: mockEmployeeRows[0].employee_address,
        sourceAsset: {
          code: mockEmployeeRows[0].source_asset_code,
          issuer: mockEmployeeRows[0].source_asset_issuer,
          isNative: false,
        },
        destinationAsset: {
          code: mockEmployeeRows[0].dest_asset_code,
          issuer: mockEmployeeRows[0].dest_asset_issuer,
          isNative: false,
        },
        sourceAmount: mockEmployeeRows[0].source_amount,
        destinationAmount: mockEmployeeRows[0].dest_amount,
        maximumSourceAmount: mockEmployeeRows[0].max_source_amount,
        minimumDestinationAmount: mockEmployeeRows[0].min_dest_amount,
        actualSourceAmount: mockEmployeeRows[0].actual_source_amount,
        actualDestinationAmount: mockEmployeeRows[0].actual_dest_amount,
        status: mockEmployeeRows[0].status,
        txHash: mockEmployeeRows[0].tx_hash,
        errorMessage: mockEmployeeRows[0].error_message,
        slippage: mockEmployeeRows[0].slippage,
        priceImpact: mockEmployeeRows[0].price_impact,
        createdAt: mockEmployeeRows[0].created_at,
        processedAt: mockEmployeeRows[0].processed_at,
      });
    });

    it('should return empty array for non-existent run', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [],
      } as any);

      const result = await PayrollPathPaymentService.getEmployeePayments('nonexistent');

      expect(result).toEqual([]);
    });
  });

  describe('getOrganizationPayrollRuns', () => {
    it('should return paginated payroll runs', async () => {
      const mockRuns = [
        {
          id: 'run-1',
          organization_id: 1,
          employer_address: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
          source_asset_code: 'USDC',
          source_asset_issuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
          payment_type: 'strict_send',
          total_employees: 2,
          successful_payments: 2,
          failed_payments: 0,
          status: 'completed',
          created_at: new Date(),
        },
      ];

      mockQuery.mockResolvedValueOnce({
        rows: mockRuns,
      } as any);

      const result = await PayrollPathPaymentService.getOrganizationPayrollRuns(1, 10, 0);

      expect(result).toHaveLength(1);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY created_at DESC'),
        [1, 10, 0]
      );
    });

    it('should use default pagination values', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] } as any);

      await PayrollPathPaymentService.getOrganizationPayrollRuns(1);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.any(String),
        [1, 50, 0] // Default limit and offset
      );
    });
  });
});