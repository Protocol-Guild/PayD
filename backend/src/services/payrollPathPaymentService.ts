import { AssetPathPaymentService, AssetInfo, EmployeePaymentItem, PayrollPathPaymentParams, PayrollRunResult, EmployerPathConfig } from './assetPathPaymentService.js';
import { PayrollSchedulerService } from './payrollSchedulerService.js';
import { pool } from '../config/database.js';
import logger from '../utils/logger.js';

export interface PayrollPathConfiguration {
  organizationId: number;
  employerAddress: string;
  defaultSourceAsset: AssetInfo;
  maxSlippageBps: number;
  maxPriceImpactBps: number;
  autoApproveThreshold: string;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface PayrollPathRun {
  id: string;
  organizationId: number;
  employerAddress: string;
  sourceAsset: AssetInfo;
  paymentType: 'strict_send' | 'strict_receive';
  totalEmployees: number;
  successfulPayments: number;
  failedPayments: number;
  totalSourceAmount?: string;
  totalDestinationAmount?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  contractRunId?: number;
  createdAt: Date;
  completedAt?: Date;
  errorMessage?: string;
}

export interface EmployeePathPayment {
  id: string;
  payrollRunId: string;
  employeeId: number;
  employeeAddress: string;
  sourceAsset: AssetInfo;
  destinationAsset: AssetInfo;
  sourceAmount?: string;
  destinationAmount: string;
  maximumSourceAmount: string;
  minimumDestinationAmount: string;
  actualSourceAmount?: string;
  actualDestinationAmount?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  txHash?: string;
  errorMessage?: string;
  slippage?: number;
  priceImpact?: number;
  createdAt: Date;
  processedAt?: Date;
}

export class PayrollPathPaymentService {
  
  /// Configure organization for path payment payrolls
  static async configureOrganizationPathPayments(
    config: PayrollPathConfiguration
  ): Promise<boolean> {
    try {
      // Store configuration in database
      const result = await pool.query(
        `INSERT INTO payroll_path_configs 
         (organization_id, employer_address, default_source_asset_code, default_source_asset_issuer,
          max_slippage_bps, max_price_impact_bps, auto_approve_threshold, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (organization_id) 
         DO UPDATE SET 
           employer_address = EXCLUDED.employer_address,
           default_source_asset_code = EXCLUDED.default_source_asset_code,
           default_source_asset_issuer = EXCLUDED.default_source_asset_issuer,
           max_slippage_bps = EXCLUDED.max_slippage_bps,
           max_price_impact_bps = EXCLUDED.max_price_impact_bps,
           auto_approve_threshold = EXCLUDED.auto_approve_threshold,
           is_active = EXCLUDED.is_active,
           updated_at = NOW()
         RETURNING *`,
        [
          config.organizationId,
          config.employerAddress,
          config.defaultSourceAsset.code,
          config.defaultSourceAsset.issuer || null,
          config.maxSlippageBps,
          config.maxPriceImpactBps,
          config.autoApproveThreshold,
          config.isActive,
        ]
      );

      // Configure employer in the Soroban contract
      const employerConfig: EmployerPathConfig = {
        employerAddress: config.employerAddress,
        defaultSourceAsset: config.defaultSourceAsset,
        maxSlippageBps: config.maxSlippageBps,
        maxPriceImpactBps: config.maxPriceImpactBps,
        autoApproveThreshold: config.autoApproveThreshold,
        isActive: config.isActive,
      };

      const contractConfigured = await AssetPathPaymentService.configureEmployerPathPayments(employerConfig);

      if (!contractConfigured) {
        logger.error('Failed to configure employer in Soroban contract', { config });
        return false;
      }

      logger.info('Organization configured for path payment payrolls', {
        organizationId: config.organizationId,
        employerAddress: config.employerAddress,
        defaultSourceAsset: config.defaultSourceAsset,
      });

      return true;
    } catch (error) {
      logger.error('Failed to configure organization for path payments', { error, config });
      return false;
    }
  }

  /// Get organization path payment configuration
  static async getOrganizationPathConfig(
    organizationId: number
  ): Promise<PayrollPathConfiguration | null> {
    try {
      const result = await pool.query(
        `SELECT * FROM payroll_path_configs WHERE organization_id = $1`,
        [organizationId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        organizationId: row.organization_id,
        employerAddress: row.employer_address,
        defaultSourceAsset: {
          code: row.default_source_asset_code,
          issuer: row.default_source_asset_issuer,
          isNative: row.default_source_asset_code === 'XLM',
        },
        maxSlippageBps: row.max_slippage_bps,
        maxPriceImpactBps: row.max_price_impact_bps,
        autoApproveThreshold: row.auto_approve_threshold,
        isActive: row.is_active,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    } catch (error) {
      logger.error('Failed to get organization path config', { error, organizationId });
      return null;
    }
  }

  /// Execute payroll using path payments
  static async executePayrollWithPathPayments(
    organizationId: number,
    employeePayments: Array<{
      employeeId: number;
      employeeAddress: string;
      destinationAsset: AssetInfo;
      destinationAmount: string;
    }>,
    paymentType: 'strict_send' | 'strict_receive' = 'strict_send'
  ): Promise<PayrollRunResult> {
    try {
      // Get organization configuration
      const config = await this.getOrganizationPathConfig(organizationId);
      if (!config || !config.isActive) {
        throw new Error(`Organization ${organizationId} not configured for path payments`);
      }

      // Create payroll run record
      const runResult = await pool.query(
        `INSERT INTO payroll_path_runs 
         (organization_id, employer_address, source_asset_code, source_asset_issuer,
          payment_type, total_employees, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'pending')
         RETURNING id`,
        [
          organizationId,
          config.employerAddress,
          config.defaultSourceAsset.code,
          config.defaultSourceAsset.issuer || null,
          paymentType,
          employeePayments.length,
        ]
      );

      const runId = runResult.rows[0].id;

      // Estimate costs first
      const costEstimate = await AssetPathPaymentService.estimatePayrollPathCosts(
        config.defaultSourceAsset,
        employeePayments.map(emp => ({
          destinationAsset: emp.destinationAsset,
          destinationAmount: emp.destinationAmount,
        })),
        paymentType
      );

      logger.info('Payroll path payment cost estimate', {
        runId,
        totalEstimatedSourceCost: costEstimate.totalEstimatedSourceCost,
        totalDestinationAmount: costEstimate.totalDestinationAmount,
        averageSlippage: costEstimate.averageSlippage,
        averagePriceImpact: costEstimate.averagePriceImpact,
        feasibleEmployees: costEstimate.feasibleEmployees,
        infeasibleEmployees: costEstimate.infeasibleEmployees.length,
      });

      // Create employee payment records
      const employeeItems: EmployeePaymentItem[] = [];
      for (let i = 0; i < employeePayments.length; i++) {
        const emp = employeePayments[i];
        
        // Check if this employee is feasible
        const isInfeasible = costEstimate.infeasibleEmployees.some(inf => inf.index === i);
        if (isInfeasible) {
          continue; // Skip infeasible employees
        }

        const maxSourceAmount = paymentType === 'strict_send' 
          ? (parseFloat(costEstimate.totalEstimatedSourceCost) * 1.1 / costEstimate.feasibleEmployees).toString() // 10% buffer
          : (parseFloat(emp.destinationAmount) * 2).toString(); // 100% buffer for strict_receive

        const minDestAmount = (parseFloat(emp.destinationAmount) * 0.95).toString(); // 5% slippage tolerance

        await pool.query(
          `INSERT INTO employee_path_payments 
           (payroll_run_id, employee_id, employee_address, 
            source_asset_code, source_asset_issuer,
            dest_asset_code, dest_asset_issuer, dest_amount,
            max_source_amount, min_dest_amount, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending')`,
          [
            runId,
            emp.employeeId,
            emp.employeeAddress,
            config.defaultSourceAsset.code,
            config.defaultSourceAsset.issuer || null,
            emp.destinationAsset.code,
            emp.destinationAsset.issuer || null,
            emp.destinationAmount,
            maxSourceAmount,
            minDestAmount,
          ]
        );

        employeeItems.push({
          employeeId: emp.employeeId.toString(),
          employeeAddress: emp.employeeAddress,
          destinationAsset: emp.destinationAsset,
          destinationAmount: emp.destinationAmount,
          maximumSourceAmount: maxSourceAmount,
          minimumDestinationAmount: minDestAmount,
        });
      }

      if (employeeItems.length === 0) {
        throw new Error('No feasible employee payments found');
      }

      // Update run status to processing
      await pool.query(
        `UPDATE payroll_path_runs 
         SET status = 'processing', 
             total_source_amount = $1,
             total_dest_amount = $2
         WHERE id = $3`,
        [costEstimate.totalEstimatedSourceCost, costEstimate.totalDestinationAmount, runId]
      );

      // Execute the payroll path payments
      const payrollParams: PayrollPathPaymentParams = {
        employerAddress: config.employerAddress,
        sourceAsset: config.defaultSourceAsset,
        employees: employeeItems,
        paymentType,
        maxSlippageBps: config.maxSlippageBps,
        maxPriceImpactBps: config.maxPriceImpactBps,
      };

      const executionResult = await AssetPathPaymentService.executePayrollPathPayments(payrollParams);

      // Update run with results
      const finalStatus = executionResult.success ? 'completed' : 'failed';
      await pool.query(
        `UPDATE payroll_path_runs 
         SET status = $1, 
             successful_payments = $2,
             failed_payments = $3,
             contract_run_id = $4,
             completed_at = NOW(),
             error_message = $5
         WHERE id = $6`,
        [
          finalStatus,
          executionResult.successfulPayments,
          executionResult.failedPayments,
          executionResult.contractRunId || null,
          executionResult.errors.length > 0 ? JSON.stringify(executionResult.errors) : null,
          runId,
        ]
      );

      // Update individual employee payment records
      for (const error of executionResult.errors) {
        if (error.employeeId !== 'ALL') {
          await pool.query(
            `UPDATE employee_path_payments 
             SET status = 'failed', error_message = $1, processed_at = NOW()
             WHERE payroll_run_id = $2 AND employee_id = $3`,
            [error.error, runId, parseInt(error.employeeId)]
          );
        }
      }

      logger.info('Payroll path payments completed', {
        runId,
        organizationId,
        totalEmployees: executionResult.totalEmployees,
        successfulPayments: executionResult.successfulPayments,
        failedPayments: executionResult.failedPayments,
        success: executionResult.success,
      });

      return {
        ...executionResult,
        runId,
      };

    } catch (error) {
      logger.error('Failed to execute payroll with path payments', { error, organizationId });
      
      return {
        success: false,
        totalEmployees: employeePayments.length,
        successfulPayments: 0,
        failedPayments: employeePayments.length,
        errors: [{
          employeeId: 'ALL',
          error: error instanceof Error ? error.message : 'Unknown error',
        }],
      };
    }
  }

  /// Get payroll path run status
  static async getPayrollRunStatus(runId: string): Promise<PayrollPathRun | null> {
    try {
      const result = await pool.query(
        `SELECT * FROM payroll_path_runs WHERE id = $1`,
        [runId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        id: row.id,
        organizationId: row.organization_id,
        employerAddress: row.employer_address,
        sourceAsset: {
          code: row.source_asset_code,
          issuer: row.source_asset_issuer,
          isNative: row.source_asset_code === 'XLM',
        },
        paymentType: row.payment_type,
        totalEmployees: row.total_employees,
        successfulPayments: row.successful_payments || 0,
        failedPayments: row.failed_payments || 0,
        totalSourceAmount: row.total_source_amount,
        totalDestinationAmount: row.total_dest_amount,
        status: row.status,
        contractRunId: row.contract_run_id,
        createdAt: row.created_at,
        completedAt: row.completed_at,
        errorMessage: row.error_message,
      };
    } catch (error) {
      logger.error('Failed to get payroll run status', { error, runId });
      return null;
    }
  }

  /// Get employee payments for a payroll run
  static async getEmployeePayments(runId: string): Promise<EmployeePathPayment[]> {
    try {
      const result = await pool.query(
        `SELECT * FROM employee_path_payments 
         WHERE payroll_run_id = $1 
         ORDER BY created_at ASC`,
        [runId]
      );

      return result.rows.map(row => ({
        id: row.id,
        payrollRunId: row.payroll_run_id,
        employeeId: row.employee_id,
        employeeAddress: row.employee_address,
        sourceAsset: {
          code: row.source_asset_code,
          issuer: row.source_asset_issuer,
          isNative: row.source_asset_code === 'XLM',
        },
        destinationAsset: {
          code: row.dest_asset_code,
          issuer: row.dest_asset_issuer,
          isNative: row.dest_asset_code === 'XLM',
        },
        sourceAmount: row.source_amount,
        destinationAmount: row.dest_amount,
        maximumSourceAmount: row.max_source_amount,
        minimumDestinationAmount: row.min_dest_amount,
        actualSourceAmount: row.actual_source_amount,
        actualDestinationAmount: row.actual_dest_amount,
        status: row.status,
        txHash: row.tx_hash,
        errorMessage: row.error_message,
        slippage: row.slippage,
        priceImpact: row.price_impact,
        createdAt: row.created_at,
        processedAt: row.processed_at,
      }));
    } catch (error) {
      logger.error('Failed to get employee payments', { error, runId });
      return [];
    }
  }

  /// Get organization payroll runs history
  static async getOrganizationPayrollRuns(
    organizationId: number,
    limit: number = 50,
    offset: number = 0
  ): Promise<PayrollPathRun[]> {
    try {
      const result = await pool.query(
        `SELECT * FROM payroll_path_runs 
         WHERE organization_id = $1 
         ORDER BY created_at DESC 
         LIMIT $2 OFFSET $3`,
        [organizationId, limit, offset]
      );

      return result.rows.map(row => ({
        id: row.id,
        organizationId: row.organization_id,
        employerAddress: row.employer_address,
        sourceAsset: {
          code: row.source_asset_code,
          issuer: row.source_asset_issuer,
          isNative: row.source_asset_code === 'XLM',
        },
        paymentType: row.payment_type,
        totalEmployees: row.total_employees,
        successfulPayments: row.successful_payments || 0,
        failedPayments: row.failed_payments || 0,
        totalSourceAmount: row.total_source_amount,
        totalDestinationAmount: row.total_dest_amount,
        status: row.status,
        contractRunId: row.contract_run_id,
        createdAt: row.created_at,
        completedAt: row.completed_at,
        errorMessage: row.error_message,
      }));
    } catch (error) {
      logger.error('Failed to get organization payroll runs', { error, organizationId });
      return [];
    }
  }
}

export const payrollPathPaymentService = PayrollPathPaymentService;