import { Request, Response } from 'express';
import { invoiceService } from '../services/invoiceService.js';
import { invoicePDFService } from '../services/invoicePDFService.js';
import { createInvoiceSchema, reviewInvoiceSchema, invoiceQuerySchema } from '../schemas/invoiceSchema.js';
import { Pool } from 'pg';
import { config } from '../config/env.js';

const pool = new Pool({ connectionString: config.DATABASE_URL });

export class InvoiceController {
  async createInvoice(req: Request, res: Response) {
    try {
      const parsed = createInvoiceSchema.parse(req.body);
      const contractorId = req.user!.id;
      const organizationId = req.user!.organizationId!;

      const invoice = await invoiceService.createInvoice(contractorId, organizationId, parsed);
      res.status(201).json(invoice);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create invoice';
      res.status(400).json({ error: message });
    }
  }

  async getMyInvoices(req: Request, res: Response) {
    try {
      const { page, limit } = invoiceQuerySchema.parse(req.query);
      const contractorId = req.user!.id;
      const organizationId = req.user!.organizationId!;

      const result = await invoiceService.getInvoicesByContractor(
        contractorId,
        organizationId,
        page,
        limit
      );
      
      res.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch invoices';
      res.status(400).json({ error: message });
    }
  }

  async getAllInvoices(req: Request, res: Response) {
    try {
      const { page, limit, status } = invoiceQuerySchema.parse(req.query);
      const organizationId = req.user!.organizationId!;

      const result = await invoiceService.getInvoicesByOrganization(
        organizationId,
        status,
        page,
        limit
      );
      
      res.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch invoices';
      res.status(400).json({ error: message });
    }
  }

  async getInvoiceById(req: Request, res: Response) {
    try {
      const id = parseInt(String(req.params.id));
      const organizationId = req.user!.organizationId!;

      const invoice = await invoiceService.getInvoiceById(id, organizationId);
      
      if (!invoice) {
        return res.status(404).json({ error: 'Invoice not found' });
      }

      res.json(invoice);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch invoice';
      res.status(400).json({ error: message });
    }
  }

  async reviewInvoice(req: Request, res: Response) {
    try {
      const id = parseInt(String(req.params.id));
      const parsed = reviewInvoiceSchema.parse(req.body);
      const organizationId = req.user!.organizationId!;
      const reviewerId = req.user!.id;

      const invoice = await invoiceService.reviewInvoice(id, organizationId, reviewerId, parsed);
      res.json(invoice);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to review invoice';
      res.status(400).json({ error: message });
    }
  }

  async getApprovedInvoices(req: Request, res: Response) {
    try {
      const organizationId = req.user!.organizationId!;
      const invoices = await invoiceService.getApprovedInvoicesForPayment(organizationId);
      res.json(invoices);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch approved invoices';
      res.status(400).json({ error: message });
    }
  }

  async downloadInvoicePDF(req: Request, res: Response) {
    try {
      const id = parseInt(String(req.params.id));
      const organizationId = req.user!.organizationId!;

      const invoice = await invoiceService.getInvoiceById(id, organizationId);
      
      if (!invoice) {
        return res.status(404).json({ error: 'Invoice not found' });
      }

      // Get contractor info
      const contractorResult = await pool.query(
        'SELECT first_name, last_name, email, wallet_address FROM employees WHERE id = $1',
        [invoice.contractor_id]
      );
      
      if (contractorResult.rows.length === 0) {
        return res.status(404).json({ error: 'Contractor not found' });
      }

      const doc = invoicePDFService.generateInvoicePDF(invoice, contractorResult.rows[0]);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=invoice-${invoice.invoice_number}.pdf`);
      
      doc.pipe(res);
      doc.end();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to generate PDF';
      res.status(400).json({ error: message });
    }
  }
}

export const invoiceController = new InvoiceController();
