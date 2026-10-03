-- Both event indexers use contract_events. 015 stores an RPC event ID, while
-- 016 stores an organization and a transaction/event-index pair. Compose their
-- columns before 016 creates its indexes; never replace or discard event rows.
ALTER TABLE contract_events
  ADD COLUMN IF NOT EXISTS event_id TEXT,
  ADD COLUMN IF NOT EXISTS tx_hash TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS transaction_hash VARCHAR(64),
  ADD COLUMN IF NOT EXISTS event_index INTEGER,
  ADD COLUMN IF NOT EXISTS ledger_closed_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS indexed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Each producer supplies its own identifier. Unknown tenant/event metadata is
-- kept NULL instead of assigning an existing event to a fabricated tenant.
ALTER TABLE contract_events
  ALTER COLUMN event_id DROP NOT NULL,
  ALTER COLUMN organization_id DROP NOT NULL,
  ALTER COLUMN transaction_hash DROP NOT NULL,
  ALTER COLUMN event_index DROP NOT NULL,
  ALTER COLUMN ledger_closed_at DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_contract_events_chain_event
  ON contract_events (contract_id, transaction_hash, event_index);
