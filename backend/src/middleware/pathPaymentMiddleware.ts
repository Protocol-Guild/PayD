import { Request, Response, NextFunction } from 'express';
import { PayrollPathPaymentService } from '../services/payrollPathPaymentService.js';
import { AssetPathPaymentService } from '../services/assetPathPaymentService.js';
import logger from '../utils/logger.js';

export interface PathPaymentRequest extends Request {
  pathPaymentConfig?: {
    organizationId: number;
    employerAddress: string;
    defaultSourceAsset: {
      code: string;
      issuer: string | null;
      isNative: boolean;
    };
    maxSlippageBps: number;
    maxPriceImpactBps: number;
    autoApproveThreshold: string;
    isActive: boolean;
  };
  pathPaymentLimits?: {
    batchLimit: number;
    maxSlippageBps: number;
    maxPriceImpactBps: number;
  };
}

/**
 * Middleware to validate organization has path payment configuration
 */
export const requirePathPaymentConfig = async (
  req: PathPaymentRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      res.status(401).json({
        success: false,
        message: 'Organization ID required',
      });
      return;
    }

    const config = await PayrollPathPaymentService.getOrganizationPathConfig(organizationId);
    if (!config || !config.isActive) {
      res.status(400).json({
        success: false,
        message: 'Organization not configured for path payments or configuration is inactive',
      });
      return;
    }

    req.pathPaymentConfig = config;
    next();
  } catch (error) {
    logger.error('Error validating path payment config', { error, organizationId: req.user?.organizationId });
    res.status(500).json({
      success: false,
      message: 'Failed to validate organization configuration',
    });
  }
};

/**
 * Middleware to validate batch size limits
 */
export const validateBatchSize = (maxBatchSize: number = 100) => {
  return (req: PathPaymentRequest, res: Response, next: NextFunction): void => {
    const employees = req.body.employees;
    
    if (!Array.isArray(employees)) {
      res.status(400).json({
        success: false,
        message: 'Employees must be an array',
      });
      return;
    }

    if (employees.length === 0) {
      res.status(400).json({
        success: false,
        message: 'At least one employee must be provided',
      });
      return;
    }

    if (employees.length > maxBatchSize) {
      res.status(400).json({
        success: false,
        message: `Batch size exceeds maximum limit of ${maxBatchSize} employees`,
      });
      return;
    }

    next();
  };
};

/**
 * Middleware to validate slippage and price impact parameters
 */
export const validateSlippageParameters = (
  req: PathPaymentRequest,
  res: Response,
  next: NextFunction
): void => {
  const { maxSlippageBps, maxPriceImpactBps } = req.body;

  if (maxSlippageBps !== undefined) {
    const slippage = parseInt(maxSlippageBps);
    if (isNaN(slippage) || slippage < 0 || slippage > 10000) {
      res.status(400).json({
        success: false,
        message: 'Max slippage must be between 0 and 10000 basis points (0-100%)',
      });
      return;
    }
  }

  if (maxPriceImpactBps !== undefined) {
    const priceImpact = parseInt(maxPriceImpactBps);
    if (isNaN(priceImpact) || priceImpact < 0 || priceImpact > 10000) {
      res.status(400).json({
        success: false,
        message: 'Max price impact must be between 0 and 10000 basis points (0-100%)',
      });
      return;
    }
  }

  next();
};

/**
 * Middleware to validate asset parameters
 */
export const validateAssetParameters = (
  req: PathPaymentRequest,
  res: Response,
  next: NextFunction
): void => {
  const validateAsset = (asset: any, fieldName: string): boolean => {
    if (!asset || typeof asset !== 'object') {
      res.status(400).json({
        success: false,
        message: `${fieldName} must be an object with code and optional issuer`,
      });
      return false;
    }

    if (!asset.code || typeof asset.code !== 'string') {
      res.status(400).json({
        success: false,
        message: `${fieldName}.code is required and must be a string`,
      });
      return false;
    }

    if (asset.code.length > 12) {
      res.status(400).json({
        success: false,
        message: `${fieldName}.code must be 12 characters or less`,
      });
      return false;
    }

    // XLM (native) should not have an issuer
    if (asset.code === 'XLM' && asset.issuer) {
      res.status(400).json({
        success: false,
        message: `${fieldName}: Native XLM should not have an issuer`,
      });
      return false;
    }

    // Non-XLM assets should have an issuer (unless it's a test scenario)
    if (asset.code !== 'XLM' && asset.issuer) {
      if (typeof asset.issuer !== 'string' || asset.issuer.length !== 56) {
        res.status(400).json({
          success: false,
          message: `${fieldName}.issuer must be a valid 56-character Stellar public key`,
        });
        return false;
      }
    }

    return true;
  };

  // Validate source asset if present
  if (req.body.sourceAsset && !validateAsset(req.body.sourceAsset, 'sourceAsset')) {
    return;
  }

  // Validate destination asset if present
  if (req.body.destinationAsset && !validateAsset(req.body.destinationAsset, 'destinationAsset')) {
    return;
  }

  // Validate default source asset if present
  if (req.body.defaultSourceAsset && !validateAsset(req.body.defaultSourceAsset, 'defaultSourceAsset')) {
    return;
  }

  // Validate employee assets if present
  if (req.body.employees && Array.isArray(req.body.employees)) {
    for (let i = 0; i < req.body.employees.length; i++) {
      const employee = req.body.employees[i];
      if (employee.destinationAsset && !validateAsset(employee.destinationAsset, `employees[${i}].destinationAsset`)) {
        return;
      }
    }
  }

  next();
};

/**
 * Middleware to validate amount parameters
 */
export const validateAmountParameters = (
  req: PathPaymentRequest,
  res: Response,
  next: NextFunction
): void => {
  const validateAmount = (amount: any, fieldName: string, required: boolean = true): boolean => {
    if (amount === undefined || amount === null) {
      if (required) {
        res.status(400).json({
          success: false,
          message: `${fieldName} is required`,
        });
        return false;
      }
      return true;
    }

    // Convert to string if it's a number
    const amountStr = typeof amount === 'number' ? amount.toString() : amount;
    
    if (typeof amountStr !== 'string') {
      res.status(400).json({
        success: false,
        message: `${fieldName} must be a string or number`,
      });
      return false;
    }

    // Validate numeric format
    const numericAmount = parseFloat(amountStr);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      res.status(400).json({
        success: false,
        message: `${fieldName} must be a positive number`,
      });
      return false;
    }

    // Check for excessive precision (more than 7 decimal places for Stellar)
    const decimalPlaces = (amountStr.split('.')[1] || '').length;
    if (decimalPlaces > 7) {
      res.status(400).json({
        success: false,
        message: `${fieldName} cannot have more than 7 decimal places`,
      });
      return false;
    }

    return true;
  };

  // Validate main amount if present
  if (req.body.amount !== undefined && !validateAmount(req.body.amount, 'amount')) {
    return;
  }

  // Validate auto approve threshold if present
  if (req.body.autoApproveThreshold !== undefined && !validateAmount(req.body.autoApproveThreshold, 'autoApproveThreshold')) {
    return;
  }

  // Validate employee amounts if present
  if (req.body.employees && Array.isArray(req.body.employees)) {
    for (let i = 0; i < req.body.employees.length; i++) {
      const employee = req.body.employees[i];
      
      if (!validateAmount(employee.destinationAmount, `employees[${i}].destinationAmount`)) {
        return;
      }

      if (employee.maximumSourceAmount !== undefined && 
          !validateAmount(employee.maximumSourceAmount, `employees[${i}].maximumSourceAmount`, false)) {
        return;
      }

      if (employee.minimumDestinationAmount !== undefined && 
          !validateAmount(employee.minimumDestinationAmount, `employees[${i}].minimumDestinationAmount`, false)) {
        return;
      }
    }
  }

  next();
};

/**
 * Middleware to validate Stellar address parameters
 */
export const validateStellarAddresses = (
  req: PathPaymentRequest,
  res: Response,
  next: NextFunction
): void => {
  const validateAddress = (address: any, fieldName: string): boolean => {
    if (!address || typeof address !== 'string') {
      res.status(400).json({
        success: false,
        message: `${fieldName} is required and must be a string`,
      });
      return false;
    }

    if (address.length !== 56 || !address.startsWith('G')) {
      res.status(400).json({
        success: false,
        message: `${fieldName} must be a valid 56-character Stellar public key starting with 'G'`,
      });
      return false;
    }

    return true;
  };

  // Validate employer address if present
  if (req.body.employerAddress && !validateAddress(req.body.employerAddress, 'employerAddress')) {
    return;
  }

  // Validate employee addresses if present
  if (req.body.employees && Array.isArray(req.body.employees)) {
    for (let i = 0; i < req.body.employees.length; i++) {
      const employee = req.body.employees[i];
      if (employee.employeeAddress && !validateAddress(employee.employeeAddress, `employees[${i}].employeeAddress`)) {
        return;
      }
    }
  }

  next();
};

/**
 * Middleware to add rate limiting for path payment operations
 */
export const pathPaymentRateLimit = (windowMs: number = 60000, maxRequests: number = 10) => {
  const requestCounts = new Map<string, { count: number; resetTime: number }>();

  return (req: PathPaymentRequest, res: Response, next: NextFunction): void => {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      res.status(401).json({
        success: false,
        message: 'Organization ID required',
      });
      return;
    }

    const key = `path-payment:${organizationId}`;
    const now = Date.now();
    const windowStart = now - windowMs;

    let record = requestCounts.get(key);
    if (!record || record.resetTime < windowStart) {
      record = { count: 0, resetTime: now + windowMs };
      requestCounts.set(key, record);
    }

    if (record.count >= maxRequests) {
      res.status(429).json({
        success: false,
        message: 'Too many path payment requests. Please try again later.',
        retryAfter: Math.ceil((record.resetTime - now) / 1000),
      });
      return;
    }

    record.count++;
    next();
  };
};

/**
 * Middleware to log path payment operations for audit purposes
 */
export const logPathPaymentOperation = (
  req: PathPaymentRequest,
  res: Response,
  next: NextFunction
): void => {
  const originalSend = res.send;
  
  res.send = function(data: any) {
    const response = typeof data === 'string' ? JSON.parse(data) : data;
    
    logger.info('Path payment operation completed', {
      method: req.method,
      path: req.path,
      organizationId: req.user?.organizationId,
      userId: req.user?.id,
      success: response?.success,
      runId: response?.runId,
      contractRunId: response?.contractRunId,
      totalEmployees: response?.totalEmployees,
      statusCode: res.statusCode,
      timestamp: new Date().toISOString(),
    });

    return originalSend.call(this, data);
  };

  next();
};