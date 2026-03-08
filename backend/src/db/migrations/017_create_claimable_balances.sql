-- =============================================================================
-- Migration 017: Claimable balances + custodial wallet secrets
-- Purpose : Track claimable balances for employees who cannot receive ORGUSD
--           and store custodial wallet secrets (encrypted at rest).
-- =============================================================================

CREATE TABLE IF NOT EXISTS custodial_wallet_secrets (
  wallet_id         UUID PRIMARY KEY REFERENCES wallets(id) ON DELETE CASCADE,
  encrypted_secret  TEXT NOT NULL,
  encryption_version INTEGER NOT NULL DEFAULT 1,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS claimable_balance_claims (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  employee_id      INTEGER REFERENCES employees(id) ON DELETE SET NULL,
  claimant_wallet_id UUID REFERENCES wallets(id) ON DELETE SET NULL,

  asset_code       VARCHAR(12) NOT NULL DEFAULT 'ORGUSD',
  asset_issuer     VARCHAR(56) NOT NULL,
  amount           DECIMAL(20, 7) NOT NULL CHECK (amount > 0),

  status           VARCHAR(20) NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'claimed', 'expired', 'cancelled')),

  stellar_balance_id VARCHAR(128),
  create_tx_hash     VARCHAR(64),
  claim_tx_hash      VARCHAR(64),

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  claimed_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_cb_claims_org_id ON claimable_balance_claims(organization_id);
CREATE INDEX IF NOT EXISTS idx_cb_claims_employee_id ON claimable_balance_claims(employee_id);
CREATE INDEX IF NOT EXISTS idx_cb_claims_status ON claimable_balance_claims(status);
CREATE INDEX IF NOT EXISTS idx_cb_claims_balance_id ON claimable_balance_claims(stellar_balance_id);

CREATE TRIGGER update_claimable_balance_claims_updated_at
  BEFORE UPDATE ON claimable_balance_claims
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
