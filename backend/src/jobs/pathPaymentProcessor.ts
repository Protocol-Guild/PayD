import { Worker } from 'bullmq';
import { AssetPathPaymentService } from '../services/assetPathPaymentService.js';
import { PayrollPathPaymentService } from '../services/payrollPathPaymentService.js';
import logger from '../utils/logger.js';

export interface PathPaymentJob {
  type: 'execute_payroll' | 'process_employee' | 'estimate_costs';
  data: any;
}

export class PathPaymentProcessor {
  private worker: Worker;

  constructor() {
    this.worker = new Worker('path-payments', this.processJob.bind(this), {
      connection: { host: 'localhost', port: 6379 },
      concurrency: 5,
    });

    this.worker.on('completed', (job) => {
      logger.info('Path payment job completed', { jobId: job.id, jobData: job.data });
    });

    this.worker.on('failed', (job, err) => {
      logger.error('Path payment job failed', { 
        jobId: job?.id, 
        error: err.message,
        jobData: job?.data 
      });
    });
  }

  private async processJob(job: any) {
    const { type, data } = job.data as PathPaymentJob;

    switch (type) {
      case 'execute_payroll':
        return this.executePayroll(data);
      case 'process_employee':
        return this.processEmployee(data);
      case 'estimate_costs':
        return this.estimateCosts(data);
      default:
        throw new Error(`Unknown job type: ${type}`);
    }
  }

  private async executePayroll(data: any) {
    logger.info('Processing payroll execution job', { organizationId: data.organizationId });
    
    return PayrollPathPaymentService.executePayrollWithPathPayments(
      data.organizationId,
      data.employees,
      data.paymentType
    );
  }

  private async processEmployee(data: any) {
    logger.info('Processing employee payment', { runId: data.runId, employeeId: data.employeeId });
    
    // Implementation would handle individual employee payment processing
    return { success: true };
  }

  private async estimateCosts(data: any) {
    logger.info('Estimating payroll costs', { assetPairs: data.employees?.length });
    
    return AssetPathPaymentService.estimatePayrollPathCosts(
      data.sourceAsset,
      data.employees,
      data.paymentType
    );
  }

  public async close() {
    await this.worker.close();
  }
}

export const pathPaymentProcessor = new PathPaymentProcessor();