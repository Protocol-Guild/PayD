-- =============================================================================
-- Migration 030: Webhook Delivery Metrics Table
-- Purpose : Track webhook delivery attempts, successes, and failures for
--           health reporting and monitoring.
--
-- Design decisions:
--   • Separate from subscriptions table to avoid coupling
--   • Includes retry tracking (attempt_number)
--   • Stores HTTP status codes and error details for debugging
--   • Partitioning-friendly time-based primary key (created_at + id)
--   • Tenant isolation via organization_id
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Core webhook_delivery_metrics table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS webhook_delivery_metrics (
  -- Composite primary key for time-based partitioning
  id               BIGSERIAL,
  created_at       TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  
  -- Tenant scope
  organization_id  INTEGER
                     REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Webhook subscription reference
  subscription_id  VARCHAR(255)    NOT NULL,
  
  -- Event details
  event_type       VARCHAR(100)    NOT NULL,
  event_id         VARCHAR(255),           -- Optional reference to source event
  
  -- Delivery attempt details
  attempt_number   INTEGER         NOT NULL DEFAULT 1,
  url              TEXT            NOT NULL,
  
  -- Delivery outcome
  status           VARCHAR(20)     NOT NULL
                     CHECK (status IN ('pending', 'success', 'failure', 'retry_scheduled')),
  http_status      INTEGER,                -- HTTP status code from response
  response_time_ms INTEGER,                -- Time taken for delivery attempt
  
  -- Error details (if failed)
  error_code       VARCHAR(100),
  error_message    TEXT,
  error_details    JSONB           DEFAULT '{}',
  
  -- Retry information
  retry_count      INTEGER         NOT NULL DEFAULT 0,
  next_retry_at    TIMESTAMPTZ,
  
  -- Metadata for correlation and debugging
  request_id       VARCHAR(255),           -- Correlation ID for tracking
  metadata         JSONB           DEFAULT '{}',
  
  PRIMARY KEY (created_at, id)
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

-- Primary access pattern: "show me delivery metrics for org X"
CREATE INDEX IF NOT EXISTS idx_webhook_delivery_org
  ON webhook_delivery_metrics (organization_id, created_at DESC);

-- Subscription drill-down: "how is subscription Y performing?"
CREATE INDEX IF NOT EXISTS idx_webhook_delivery_subscription
  ON webhook_delivery_metrics (subscription_id, created_at DESC);

-- Event type analysis: "how are payment.completed events delivering?"
CREATE INDEX IF NOT EXISTS idx_webhook_delivery_event
  ON webhook_delivery_metrics (event_type, created_at DESC);

-- Status monitoring: "show recent failures"
CREATE INDEX IF NOT EXISTS idx_webhook_delivery_status
  ON webhook_delivery_metrics (status, created_at DESC)
  WHERE status IN ('failure', 'retry_scheduled');

-- For retry scheduling queries
CREATE INDEX IF NOT EXISTS idx_webhook_delivery_retry
  ON webhook_delivery_metrics (next_retry_at)
  WHERE next_retry_at IS NOT NULL AND status = 'retry_scheduled';

-- BRIN index on created_at for time-range queries
CREATE INDEX IF NOT EXISTS idx_webhook_delivery_created_at_brin
  ON webhook_delivery_metrics USING BRIN (created_at)
  WITH (pages_per_range = 128);

-- ---------------------------------------------------------------------------
-- Row-Level Security
-- ---------------------------------------------------------------------------
ALTER TABLE webhook_delivery_metrics ENABLE ROW LEVEL SECURITY;

-- Application can read delivery metrics for its own organization
CREATE POLICY webhook_delivery_metrics_select ON webhook_delivery_metrics
  FOR SELECT
  USING (
    organization_id = current_tenant_id()
  );

-- Application can insert delivery metrics for its own organization
CREATE POLICY webhook_delivery_metrics_insert ON webhook_delivery_metrics
  FOR INSERT
  WITH CHECK (
    organization_id = current_tenant_id()
  );

-- Application can update delivery metrics for its own organization (for retries)
CREATE POLICY webhook_delivery_metrics_update ON webhook_delivery_metrics
  FOR UPDATE
  USING (
    organization_id = current_tenant_id()
  );

-- ---------------------------------------------------------------------------
-- Helper function: record webhook delivery attempt
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION log_webhook_delivery(
  p_organization_id   INTEGER,
  p_subscription_id   VARCHAR(255),
  p_event_type        VARCHAR(100),
  p_event_id          VARCHAR(255) DEFAULT NULL,
  p_attempt_number    INTEGER DEFAULT 1,
  p_url               TEXT,
  p_status            VARCHAR(20),
  p_http_status       INTEGER DEFAULT NULL,
  p_response_time_ms  INTEGER DEFAULT NULL,
  p_error_code        VARCHAR(100) DEFAULT NULL,
  p_error_message     TEXT DEFAULT NULL,
  p_error_details     JSONB DEFAULT '{}',
  p_retry_count       INTEGER DEFAULT 0,
  p_next_retry_at     TIMESTAMPTZ DEFAULT NULL,
  p_request_id        VARCHAR(255) DEFAULT NULL,
  p_metadata          JSONB DEFAULT '{}'
)
RETURNS BIGINT AS $$
DECLARE
  v_id BIGINT;
BEGIN
  INSERT INTO webhook_delivery_metrics (
    organization_id, subscription_id, event_type, event_id,
    attempt_number, url, status, http_status, response_time_ms,
    error_code, error_message, error_details, retry_count,
    next_retry_at, request_id, metadata, created_at
  )
  VALUES (
    p_organization_id, p_subscription_id, p_event_type, p_event_id,
    p_attempt_number, p_url, p_status, p_http_status, p_response_time_ms,
    p_error_code, p_error_message, p_error_details, p_retry_count,
    p_next_retry_at, p_request_id, p_metadata, NOW()
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- Convenience view: webhook delivery health summary (last 7 days)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW webhook_delivery_health_summary AS
SELECT
  wdm.organization_id,
  wdm.subscription_id,
  wdm.event_type,
  COUNT(*) as total_attempts,
  COUNT(CASE WHEN wdm.status = 'success' THEN 1 END) as successful_attempts,
  COUNT(CASE WHEN wdm.status = 'failure' THEN 1 END) as failed_attempts,
  COUNT(CASE WHEN wdm.status = 'retry_scheduled' THEN 1 END) as pending_retries,
  AVG(wdm.response_time_ms) as avg_response_time_ms,
  MIN(wdm.created_at) as first_attempt,
  MAX(wdm.created_at) as last_attempt,
  -- Success rate percentage
  ROUND(
    (COUNT(CASE WHEN wdm.status = 'success' THEN 1 END)::DECIMAL / 
     NULLIF(COUNT(*), 0)::DECIMAL) * 100, 2
  ) as success_rate_percent,
  -- Most common error (if any)
  MODE() WITHIN GROUP (ORDER BY wdm.error_code) as most_common_error_code,
  -- Recent failure pattern (last 24 hours)
  COUNT(CASE WHEN wdm.status = 'failure' AND wdm.created_at >= NOW() - INTERVAL '24 hours' THEN 1 END) as recent_failures_24h
FROM webhook_delivery_metrics wdm
WHERE wdm.created_at >= NOW() - INTERVAL '7 days'
GROUP BY wdm.organization_id, wdm.subscription_id, wdm.event_type;

-- ---------------------------------------------------------------------------
-- Comments
-- ---------------------------------------------------------------------------
COMMENT ON TABLE webhook_delivery_metrics IS
  'Tracks webhook delivery attempts for health monitoring and reporting. '
  'Each row represents a single delivery attempt (including retries).';

COMMENT ON COLUMN webhook_delivery_metrics.attempt_number IS
  'Indicates which attempt this is (1 = first attempt, 2 = first retry, etc.)';

COMMENT ON COLUMN webhook_delivery_metrics.status IS
  'Delivery status: pending (queued), success (200-299 HTTP), failure (non-2xx or timeout), retry_scheduled';

COMMENT ON COLUMN webhook_delivery_metrics.error_details IS
  'Structured error details including stack traces, response bodies, etc.';

COMMENT ON VIEW webhook_delivery_health_summary IS
  '7-day rolling summary of webhook delivery health per subscription and event type. '
  'Used for health dashboards and alerting.';

COMMENT ON FUNCTION log_webhook_delivery IS
  'Convenience wrapper for inserting webhook delivery metrics. Use from application code.';
