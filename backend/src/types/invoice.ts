export interface Invoice {
  id: number;
  organization_id: number;
  contractor_id: number;
  invoice_number: string;
  hours: number;
  rate: number;
  total_amount: number;
  currency: string;
  description?: string;
  attachment_url?: string;
  status: 'pending' | 'approved' | 'rejected' | 'paid';
  submitted_at: Date;
  reviewed_at?: Date;
  reviewed_by?: number;
  rejection_reason?: string;
  payment_tx_hash?: string;
  created_at: Date;
  updated_at: Date;
}

export interface CreateInvoiceInput {
  hours: number;
  rate: number;
  currency?: string;
  description?: string;
  attachment_url?: string;
}

export interface ReviewInvoiceInput {
  status: 'approved' | 'rejected';
  rejection_reason?: string;
}
