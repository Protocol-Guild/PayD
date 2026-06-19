-- Migration: Add payroll path payment functionality tables
-- Issue #215: Stellar Path Payments Integration for Employers

-- Table: payroll_path_configs
-- Stores employer configuration for path payment payrolls
CREATE TABLE IF NOT EXISTS payroll_path_configs (
    organization_id INTEGER PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
    employer_address VARCHAR(56) NOT NULL, -- Stellar public key
    default_source_asset_code VARCHAR(12) NOT NULL,
    default_source_asset_issuer VARCHAR(56), -- NULL for native XLM
    max_slippage_bps INTEGER NOT NULL DEFAULT 500, -- basis points (5%)
    max_price_impact_bps INTEGER NOT NULL DEFAULT 1000, -- basis points (10%)
    auto_approve_threshold DECIMAL(20, 7) NOT NULL DEFAULT 1000.0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT valid_slippage CHECK (max_slippage_bps >= 0 AND max_slippage_bps <= 10000),
    CONSTRAINT valid_price_impact CHECK (max_price_impact_bps >= 0 AND max_price_impact_bps <= 10000),
    CONSTRAINT valid_threshold CHECK (auto_approve_threshold > 0)
);

-- Table: payroll_path_runs
-- Stores individual payroll runs using path payments
CREATE TABLE IF NOT EXISTS payroll_path_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    employer_address VARCHAR(56) NOT NULL,
    source_asset_code VARCHAR(12) NOT NULL,
    source_asset_issuer VARCHAR(56), -- NULL for native XLM
    payment_type VARCHAR(20) NOT NULL DEFAULT 'strict_send', -- 'strict_send' or 'strict_receive'
    total_employees INTEGER NOT NULL,
    successful_payments INTEGER DEFAULT 0,
    failed_payments INTEGER DEFAULT 0,
    total_source_amount DECIMAL(20, 7), -- Estimated/actual total source amount needed
    total_dest_amount DECIMAL(20, 7), -- Total destination amount to be paid
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
    contract_run_id BIGINT, -- Reference to Soroban contract run ID
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    
    CONSTRAINT valid_payment_type CHECK (payment_type IN ('strict_send', 'strict_receive')),
    CONSTRAINT valid_status CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    CONSTRAINT valid_employee_count CHECK (total_employees > 0)
);

-- Table: employee_path_payments
-- Stores individual employee payments within a payroll run
CREATE TABLE IF NOT EXISTS employee_path_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payroll_run_id UUID NOT NULL REFERENCES payroll_path_runs(id) ON DELETE CASCADE,
    employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    employee_address VARCHAR(56) NOT NULL, -- Employee's Stellar address
    
    -- Source asset (what employer pays with)
    source_asset_code VARCHAR(12) NOT NULL,
    source_asset_issuer VARCHAR(56), -- NULL for native XLM
    source_amount DECIMAL(20, 7), -- Actual source amount sent (filled after execution)
    max_source_amount DECIMAL(20, 7) NOT NULL, -- Maximum source amount willing to pay
    
    -- Destination asset (what employee receives)
    dest_asset_code VARCHAR(12) NOT NULL,
    dest_asset_issuer VARCHAR(56), -- NULL for native XLM
    dest_amount DECIMAL(20, 7) NOT NULL, -- Expected destination amount
    min_dest_amount DECIMAL(20, 7) NOT NULL, -- Minimum acceptable destination amount
    actual_dest_amount DECIMAL(20, 7), -- Actual destination amount received (filled after execution)
    
    -- Execution details
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
    tx_hash VARCHAR(64), -- Stellar transaction hash
    error_message TEXT,
    slippage DECIMAL(8, 4), -- Actual slippage percentage
    price_impact DECIMAL(8, 4), -- Price impact percentage
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE,
    
    CONSTRAINT valid_employee_status CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    CONSTRAINT valid_amounts CHECK (
        dest_amount > 0 AND 
        max_source_amount > 0 AND 
        min_dest_amount > 0 AND 
        min_dest_amount <= dest_amount
    )
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_payroll_path_configs_org_id ON payroll_path_configs(organization_id);
CREATE INDEX IF NOT EXISTS idx_payroll_path_configs_employer ON payroll_path_configs(employer_address);
CREATE INDEX IF NOT EXISTS idx_payroll_path_configs_active ON payroll_path_configs(is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_payroll_path_runs_org_id ON payroll_path_runs(organization_id);
CREATE INDEX IF NOT EXISTS idx_payroll_path_runs_employer ON payroll_path_runs(employer_address);
CREATE INDEX IF NOT EXISTS idx_payroll_path_runs_status ON payroll_path_runs(status);
CREATE INDEX IF NOT EXISTS idx_payroll_path_runs_created_at ON payroll_path_runs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payroll_path_runs_contract_id ON payroll_path_runs(contract_run_id);

CREATE INDEX IF NOT EXISTS idx_employee_path_payments_run_id ON employee_path_payments(payroll_run_id);
CREATE INDEX IF NOT EXISTS idx_employee_path_payments_employee_id ON employee_path_payments(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_path_payments_status ON employee_path_payments(status);
CREATE INDEX IF NOT EXISTS idx_employee_path_payments_tx_hash ON employee_path_payments(tx_hash);
CREATE INDEX IF NOT EXISTS idx_employee_path_payments_created_at ON employee_path_payments(created_at DESC);

-- Add comments for documentation
COMMENT ON TABLE payroll_path_configs IS 'Configuration settings for organizations using path payment payrolls';
COMMENT ON TABLE payroll_path_runs IS 'Individual payroll runs executed using Stellar path payments';
COMMENT ON TABLE employee_path_payments IS 'Individual employee payments within path payment payroll runs';

COMMENT ON COLUMN payroll_path_configs.max_slippage_bps IS 'Maximum slippage tolerance in basis points (e.g., 500 = 5%)';
COMMENT ON COLUMN payroll_path_configs.max_price_impact_bps IS 'Maximum price impact tolerance in basis points (e.g., 1000 = 10%)';
COMMENT ON COLUMN payroll_path_configs.auto_approve_threshold IS 'Auto-approve payments below this source amount threshold';

COMMENT ON COLUMN payroll_path_runs.payment_type IS 'Type of path payment: strict_send (fixed source) or strict_receive (fixed destination)';
COMMENT ON COLUMN payroll_path_runs.contract_run_id IS 'Reference to the Soroban contract payroll run ID';

COMMENT ON COLUMN employee_path_payments.slippage IS 'Actual slippage experienced as percentage (e.g., 2.5 for 2.5%)';
COMMENT ON COLUMN employee_path_payments.price_impact IS 'Price impact on liquidity pools as percentage (e.g., 1.2 for 1.2%)';