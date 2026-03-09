-- Create invoices table for contractor payments
CREATE TABLE IF NOT EXISTS invoices (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contractor_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  invoice_number VARCHAR(50) UNIQUE NOT NULL,
  hours DECIMAL(10, 2) NOT NULL CHECK (hours > 0),
  rate DECIMAL(20, 7) NOT NULL CHECK (rate > 0),
  total_amount DECIMAL(20, 7) GENERATED ALWAYS AS (hours * rate) STORED,
  currency VARCHAR(12) NOT NULL DEFAULT 'USDC',
  description TEXT,
  attachment_url VARCHAR(500),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'paid')),
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TIMESTAMP,
  reviewed_by INTEGER REFERENCES employees(id),
  rejection_reason TEXT,
  payment_tx_hash VARCHAR(64),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add role column to employees table
ALTER TABLE employees ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'EMPLOYEE' CHECK (role IN ('EMPLOYEE', 'CONTRACTOR'));

-- Create indexes
CREATE INDEX idx_invoices_org_id ON invoices(organization_id);
CREATE INDEX idx_invoices_contractor_id ON invoices(contractor_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_submitted_at ON invoices(submitted_at);

-- Apply updated_at trigger
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
