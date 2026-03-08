-- Migration: Add auth fields to users and create social_identities table
-- Description: Adds email, name, and role to users table, and creates social_identities for OAuth links.

-- 1. Add missing columns to users table and make wallet_address nullable
-- Note: wallet_address was previously UNIQUE NOT NULL. Social login users might not have one initially.
ALTER TABLE users ALTER COLUMN wallet_address DROP NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'user';

-- 2. Create social_identities table for multiple auth providers (Google, GitHub, etc.)
CREATE TABLE IF NOT EXISTS social_identities (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL, -- 'google', 'github', etc.
  provider_id VARCHAR(255) NOT NULL, -- the unique ID from the provider
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(provider, provider_id)
);

-- 3. Add index for faster lookups during login
CREATE INDEX IF NOT EXISTS idx_social_identities_user_id ON social_identities(user_id);
CREATE INDEX IF NOT EXISTS idx_social_identities_provider_lookup ON social_identities(provider, provider_id);

-- 4. Apply updated_at trigger to social_identities
CREATE TRIGGER update_social_identities_updated_at BEFORE UPDATE ON social_identities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
