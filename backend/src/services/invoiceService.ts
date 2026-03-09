import { Pool } from 'pg';
import { config } from '../config/env.js';
import { Invoice, CreateInvoiceInput, ReviewInvoiceInput } from '../types/invoice.js';

const pool = new Pool({ connectionString: config.DATABASE_URL });

export class InvoiceService {
  async createInvoice(
    contractorId: number,
    organizationId: number,
    data: CreateInvoiceInput
  ): Promise<Invoice> {
    const invoiceNumber = `INV-${Date.now()}-${contractorId}`;
    
    const result = await pool.query<Invoice>(
      `INSERT INTO invoices (organization_id, contractor_id, invoice_number, hours, rate, currency, description, attachment_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [organizationId, contractorId, invoiceNumber, data.hours, data.rate, data.currency || 'USDC', data.description, data.attachment_url]
    );
    
    return result.rows[0];
  }

  async getInvoiceById(id: number, organizationId: number): Promise<Invoice | null> {
    const result = await pool.query<Invoice>(
      'SELECT * FROM invoices WHERE id = $1 AND organization_id = $2',
      [id, organizationId]
    );
    return result.rows[0] || null;
  }

  async getInvoicesByContractor(
    contractorId: number,
    organizationId: number,
    page = 1,
    limit = 10
  ): Promise<{ invoices: Invoice[]; total: number }> {
    const offset = (page - 1) * limit;
    
    const [invoices, count] = await Promise.all([
      pool.query<Invoice>(
        `SELECT * FROM invoices 
         WHERE contractor_id = $1 AND organization_id = $2 
         ORDER BY submitted_at DESC 
         LIMIT $3 OFFSET $4`,
        [contractorId, organizationId, limit, offset]
      ),
      pool.query<{ count: string }>(
        'SELECT COUNT(*) FROM invoices WHERE contractor_id = $1 AND organization_id = $2',
        [contractorId, organizationId]
      ),
    ]);
    
    return { invoices: invoices.rows, total: parseInt(count.rows[0].count) };
  }

  async getInvoicesByOrganization(
    organizationId: number,
    status?: string,
    page = 1,
    limit = 10
  ): Promise<{ invoices: Invoice[]; total: number }> {
    const offset = (page - 1) * limit;
    
    let query = 'SELECT i.*, e.first_name, e.last_name, e.email FROM invoices i JOIN employees e ON i.contractor_id = e.id WHERE i.organization_id = $1';
    const params: (string | number)[] = [organizationId];
    
    if (status) {
      query += ' AND i.status = $2';
      params.push(status);
    }
    
    query += ' ORDER BY i.submitted_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(limit, offset);
    
    const countQuery = status
      ? 'SELECT COUNT(*) FROM invoices WHERE organization_id = $1 AND status = $2'
      : 'SELECT COUNT(*) FROM invoices WHERE organization_id = $1';
    const countParams = status ? [organizationId, status] : [organizationId];
    
    const [invoices, count] = await Promise.all([
      pool.query(query, params),
      pool.query<{ count: string }>(countQuery, countParams),
    ]);
    
    return { invoices: invoices.rows, total: parseInt(count.rows[0].count) };
  }

  async reviewInvoice(
    id: number,
    organizationId: number,
    reviewerId: number,
    data: ReviewInvoiceInput
  ): Promise<Invoice> {
    const result = await pool.query<Invoice>(
      `UPDATE invoices 
       SET status = $1, reviewed_at = NOW(), reviewed_by = $2, rejection_reason = $3
       WHERE id = $4 AND organization_id = $5
       RETURNING *`,
      [data.status, reviewerId, data.rejection_reason, id, organizationId]
    );
    
    if (result.rows.length === 0) {
      throw new Error('Invoice not found');
    }
    
    return result.rows[0];
  }

  async getApprovedInvoicesForPayment(organizationId: number): Promise<Invoice[]> {
    const result = await pool.query<Invoice>(
      'SELECT * FROM invoices WHERE organization_id = $1 AND status = $2',
      [organizationId, 'approved']
    );
    return result.rows;
  }

  async markInvoiceAsPaid(id: number, txHash: string): Promise<void> {
    await pool.query(
      'UPDATE invoices SET status = $1, payment_tx_hash = $2 WHERE id = $3',
      ['paid', txHash, id]
    );
  }
}

export const invoiceService = new InvoiceService();
