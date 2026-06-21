import { Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { PayrollPathPaymentService } from '../services/payrollPathPaymentService.js';
import { AssetPathPaymentService } from '../services/assetPathPaymentService.js';
import logger from '../utils/logger.js';

export class PathPaymentController {
  
  /// Configure organization for path payment payrolls
  static configureOrganization = [
    body('employerAddress')
      .isString()
      .isLength({ min: 56, max: 56 })
      .withMessage('Employer address must be a valid Stellar public key'),
    body('defaultSourceAsset.code')
      .isString()
      .isLength({ min: 1, max: 12 })
      .withMessage('Asset code is required and must be 1-12 characters'),
    body('defaultSourceAsset.issuer')
      .optional()
      .isString()
      .isLength({ min: 56, max: 56 })
      .withMessage('Asset issuer must be a valid Stellar public key'),
    body('maxSlippageBps')
      .isInt({ min: 0, max: 10000 })
      .withMessage('Max slippage must be between 0 and 10000 basis points'),
    body('maxPriceImpactBps')
      .isInt({ min: 0, max: 10000 })
      .withMessage('Max price impact must be between 0 and 10000 basis points'),
    body('autoApproveThreshold')
      .isNumeric()
      .withMessage('Auto approve threshold must be a positive number'),

    async (req: Request, res: Response) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({
            success: false,
            errors: errors.array(),
          });
        }

        const organizationId = req.user?.organizationId;
        if (!organizationId) {
          return res.status(401).json({
            success: false,
            message: 'Organization ID required',
          });
        }

        const config = {
          organizationId,
          employerAddress: req.body.employerAddress,
          defaultSourceAsset: {
            code: req.body.defaultSourceAsset.code,
            issuer: req.body.defaultSourceAsset.issuer,
            isNative: req.body.defaultSourceAsset.code === 'XLM',
          },
          maxSlippageBps: parseInt(req.body.maxSlippageBps),
          maxPriceImpactBps: parseInt(req.body.maxPriceImpactBps),
          autoApproveThreshold: req.body.autoApproveThreshold.toString(),
          isActive: req.body.isActive !== false,
        };

        const success = await PayrollPathPaymentService.configureOrganizationPathPayments(config);

        if (success) {
          res.json({
            success: true,
            message: 'Organization configured for path payment payrolls',
            config,
          });
        } else {
          res.status(500).json({
            success: false,
            message: 'Failed to configure organization',
          });
        }
      } catch (error) {
        logger.error('Error configuring organization for path payments', { error });
        res.status(500).json({
          success: false,
          message: 'Internal server error',
        });
      }
    },
  ];

  /// Get organization path payment configuration
  static getOrganizationConfig = async (req: Request, res: Response) => {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) {
        return res.status(401).json({
          success: false,
          message: 'Organization ID required',
        });
      }

      const config = await PayrollPathPaymentService.getOrganizationPathConfig(organizationId);

      if (config) {
        res.json({
          success: true,
          config,
        });
      } else {
        res.status(404).json({
          success: false,
          message: 'Organization not configured for path payments',
        });
      }
    } catch (error) {
      logger.error('Error getting organization config', { error });
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  };

  /// Execute payroll using path payments
  static executePayrollRun = [
    body('employees')
      .isArray({ min: 1, max: 100 })
      .withMessage('Employees array must contain 1-100 items'),
    body('employees.*.employeeId')
      .isInt({ min: 1 })
      .withMessage('Employee ID must be a positive integer'),
    body('employees.*.employeeAddress')
      .isString()
      .isLength({ min: 56, max: 56 })
      .withMessage('Employee address must be a valid Stellar public key'),
    body('employees.*.destinationAsset.code')
      .isString()
      .isLength({ min: 1, max: 12 })
      .withMessage('Destination asset code is required'),
    body('employees.*.destinationAmount')
      .isNumeric()
      .withMessage('Destination amount must be a positive number'),
    body('paymentType')
      .optional()
      .isIn(['strict_send', 'strict_receive'])
      .withMessage('Payment type must be strict_send or strict_receive'),

    async (req: Request, res: Response) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({
            success: false,
            errors: errors.array(),
          });
        }

        const organizationId = req.user?.organizationId;
        if (!organizationId) {
          return res.status(401).json({
            success: false,
            message: 'Organization ID required',
          });
        }

        const employeePayments = req.body.employees.map((emp: any) => ({
          employeeId: parseInt(emp.employeeId),
          employeeAddress: emp.employeeAddress,
          destinationAsset: {
            code: emp.destinationAsset.code,
            issuer: emp.destinationAsset.issuer,
            isNative: emp.destinationAsset.code === 'XLM',
          },
          destinationAmount: emp.destinationAmount.toString(),
        }));

        const paymentType = req.body.paymentType || 'strict_send';

        const result = await PayrollPathPaymentService.executePayrollWithPathPayments(
          organizationId,
          employeePayments,
          paymentType
        );

        res.json({
          success: result.success,
          runId: result.runId,
          contractRunId: result.contractRunId,
          totalEmployees: result.totalEmployees,
          successfulPayments: result.successfulPayments,
          failedPayments: result.failedPayments,
          totalSourceAmount: result.totalSourceAmount,
          totalDestinationAmount: result.totalDestinationAmount,
          errors: result.errors,
        });
      } catch (error) {
        logger.error('Error executing payroll path payments', { error });
        res.status(500).json({
          success: false,
          message: 'Internal server error',
        });
      }
    },
  ];

  /// Get payroll run status
  static getPayrollRunStatus = [
    param('runId')
      .isUUID()
      .withMessage('Run ID must be a valid UUID'),

    async (req: Request, res: Response) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({
            success: false,
            errors: errors.array(),
          });
        }

        const runId = req.params.runId;
        const payrollRun = await PayrollPathPaymentService.getPayrollRunStatus(runId);

        if (!payrollRun) {
          return res.status(404).json({
            success: false,
            message: 'Payroll run not found',
          });
        }

        // Check if user has access to this organization's data
        const organizationId = req.user?.organizationId;
        if (organizationId && payrollRun.organizationId !== organizationId) {
          return res.status(403).json({
            success: false,
            message: 'Access denied',
          });
        }

        const employeePayments = await PayrollPathPaymentService.getEmployeePayments(runId);

        res.json({
          success: true,
          payrollRun,
          employeePayments,
        });
      } catch (error) {
        logger.error('Error getting payroll run status', { error });
        res.status(500).json({
          success: false,
          message: 'Internal server error',
        });
      }
    },
  ];

  /// Get organization payroll runs history
  static getPayrollRunsHistory = [
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('offset')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Offset must be non-negative'),

    async (req: Request, res: Response) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({
            success: false,
            errors: errors.array(),
          });
        }

        const organizationId = req.user?.organizationId;
        if (!organizationId) {
          return res.status(401).json({
            success: false,
            message: 'Organization ID required',
          });
        }

        const limit = parseInt(req.query.limit as string) || 50;
        const offset = parseInt(req.query.offset as string) || 0;

        const payrollRuns = await PayrollPathPaymentService.getOrganizationPayrollRuns(
          organizationId,
          limit,
          offset
        );

        res.json({
          success: true,
          payrollRuns,
          pagination: {
            limit,
            offset,
            total: payrollRuns.length,
          },
        });
      } catch (error) {
        logger.error('Error getting payroll runs history', { error });
        res.status(500).json({
          success: false,
          message: 'Internal server error',
        });
      }
    },
  ];

  /// Estimate payroll costs with path payments
  static estimatePayrollCosts = [
    body('sourceAsset.code')
      .isString()
      .isLength({ min: 1, max: 12 })
      .withMessage('Source asset code is required'),
    body('employees')
      .isArray({ min: 1, max: 100 })
      .withMessage('Employees array must contain 1-100 items'),
    body('employees.*.destinationAsset.code')
      .isString()
      .isLength({ min: 1, max: 12 })
      .withMessage('Destination asset code is required'),
    body('employees.*.destinationAmount')
      .isNumeric()
      .withMessage('Destination amount must be a positive number'),
    body('paymentType')
      .optional()
      .isIn(['strict_send', 'strict_receive'])
      .withMessage('Payment type must be strict_send or strict_receive'),

    async (req: Request, res: Response) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({
            success: false,
            errors: errors.array(),
          });
        }

        const sourceAsset = {
          code: req.body.sourceAsset.code,
          issuer: req.body.sourceAsset.issuer,
          isNative: req.body.sourceAsset.code === 'XLM',
        };

        const employees = req.body.employees.map((emp: any) => ({
          destinationAsset: {
            code: emp.destinationAsset.code,
            issuer: emp.destinationAsset.issuer,
            isNative: emp.destinationAsset.code === 'XLM',
          },
          destinationAmount: emp.destinationAmount.toString(),
        }));

        const paymentType = req.body.paymentType || 'strict_send';

        const estimate = await AssetPathPaymentService.estimatePayrollPathCosts(
          sourceAsset,
          employees,
          paymentType
        );

        res.json({
          success: true,
          estimate: {
            totalEstimatedSourceCost: estimate.totalEstimatedSourceCost,
            totalDestinationAmount: estimate.totalDestinationAmount,
            averageSlippage: estimate.averageSlippage,
            averagePriceImpact: estimate.averagePriceImpact,
            feasibleEmployees: estimate.feasibleEmployees,
            infeasibleEmployees: estimate.infeasibleEmployees,
            feasibilityRate: estimate.feasibleEmployees / employees.length,
          },
        });
      } catch (error) {
        logger.error('Error estimating payroll costs', { error });
        res.status(500).json({
          success: false,
          message: 'Internal server error',
        });
      }
    },
  ];

  /// Find optimal paths for asset conversion
  static findOptimalPaths = [
    body('sourceAsset.code')
      .isString()
      .isLength({ min: 1, max: 12 })
      .withMessage('Source asset code is required'),
    body('destinationAsset.code')
      .isString()
      .isLength({ min: 1, max: 12 })
      .withMessage('Destination asset code is required'),
    body('amount')
      .isNumeric()
      .withMessage('Amount must be a positive number'),
    body('amountType')
      .isIn(['source', 'destination'])
      .withMessage('Amount type must be source or destination'),

    async (req: Request, res: Response) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({
            success: false,
            errors: errors.array(),
          });
        }

        const sourceAsset = {
          code: req.body.sourceAsset.code,
          issuer: req.body.sourceAsset.issuer,
          isNative: req.body.sourceAsset.code === 'XLM',
        };

        const destinationAsset = {
          code: req.body.destinationAsset.code,
          issuer: req.body.destinationAsset.issuer,
          isNative: req.body.destinationAsset.code === 'XLM',
        };

        const pathOptions = {
          sourceAsset,
          destinationAsset,
          amount: req.body.amount.toString(),
          amountType: req.body.amountType as 'source' | 'destination',
          maximumSlippage: req.body.maximumSlippage,
          maximumPriceImpact: req.body.maximumPriceImpact,
        };

        const paths = await AssetPathPaymentService.findOptimalPath(pathOptions);

        res.json({
          success: true,
          paths,
          totalPaths: paths.length,
          optimalPath: paths.find(p => p.optimal) || null,
        });
      } catch (error) {
        logger.error('Error finding optimal paths', { error });
        res.status(500).json({
          success: false,
          message: 'Internal server error',
        });
      }
    },
  ];

  /// Get supported assets for path payments
  static getSupportedAssets = async (req: Request, res: Response) => {
    try {
      const assets = await AssetPathPaymentService.getSupportedAssets();
      
      res.json({
        success: true,
        assets,
        totalAssets: assets.length,
      });
    } catch (error) {
      logger.error('Error getting supported assets', { error });
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  };

  /// Get liquidity pool statistics
  static getLiquidityPoolStats = async (req: Request, res: Response) => {
    try {
      const stats = await AssetPathPaymentService.getLiquidityPoolStats();
      
      res.json({
        success: true,
        stats,
      });
    } catch (error) {
      logger.error('Error getting liquidity pool stats', { error });
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  };
}

export const pathPaymentController = PathPaymentController;