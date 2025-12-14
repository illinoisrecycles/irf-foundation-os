-- ============================================================================
-- FOUNDATION OS - MIGRATION 005: AI, Automation, Integrations
-- ============================================================================
-- Adds: Event-driven automation, Grant reviewer portal, Financial ledger,
-- AI predictions, Zoom integration, Zapier webhooks, QuickBooks sync
-- ============================================================================

-- ============================================================================
-- 1. WEBHOOKS TABLE (For Zapier/External Integrations)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  event_types TEXT[] NOT NULL DEFAULT '{}', -- member_joined, donation_received, etc.
  secret TEXT, -- For HMAC signature
  is_active BOOLEAN DEFAULT true,
  last_triggered_at TIMESTAMPTZ,
  failure_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_webhooks_org ON webhooks(organization_id);
CREATE INDEX idx_webhooks_active ON webhooks(organization_id, is_active);

-- ============================================================================
-- 2. WEBHOOK LOGS (Track deliveries)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  response_status INTEGER,
  response_body TEXT,
  delivered_at TIMESTAMPTZ DEFAULT now(),
  duration_ms INTEGER
);

CREATE INDEX idx_webhook_logs_webhook ON webhook_logs(webhook_id, delivered_at DESC);

-- ============================================================================
-- 3. EVENT BUS (Real-time event-driven automation)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.event_bus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- donation_created, member_joined, payment_failed, etc.
  payload JSONB NOT NULL,
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_event_bus_unprocessed ON event_bus(organization_id, processed, created_at);
CREATE INDEX idx_event_bus_type ON event_bus(event_type, created_at DESC);

-- ============================================================================
-- 4. AUTOMATION RULES (Visual workflow builder data)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT NOT NULL, -- donation_created, member_expired, event_registered, etc.
  trigger_conditions JSONB DEFAULT '{}', -- { "amount_cents_gte": 100000, "is_first_donation": true }
  actions JSONB NOT NULL DEFAULT '[]', -- [{ "type": "send_email", "template": "..." }, { "type": "slack_notify", ... }]
  is_active BOOLEAN DEFAULT true,
  run_count INTEGER DEFAULT 0,
  last_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_automation_rules_trigger ON automation_rules(organization_id, trigger_type, is_active);

-- ============================================================================
-- 5. GRANT REVIEWERS & REVIEWS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.grant_reviewers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  organization_name TEXT, -- For conflict detection
  email_domain TEXT GENERATED ALWAYS AS (split_part(email, '@', 2)) STORED,
  is_active BOOLEAN DEFAULT true,
  invited_at TIMESTAMPTZ DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_grant_reviewers_org ON grant_reviewers(organization_id);
CREATE INDEX idx_grant_reviewers_email ON grant_reviewers(email);
CREATE INDEX idx_grant_reviewers_domain ON grant_reviewers(email_domain);

CREATE TABLE IF NOT EXISTS public.grant_review_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grant_application_id UUID NOT NULL REFERENCES grant_applications(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES grant_reviewers(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ DEFAULT now(),
  due_date DATE,
  status TEXT DEFAULT 'pending', -- pending, in_progress, completed, recused
  has_conflict BOOLEAN DEFAULT false,
  conflict_reason TEXT,
  UNIQUE(grant_application_id, reviewer_id)
);

CREATE TABLE IF NOT EXISTS public.grant_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES grant_review_assignments(id) ON DELETE CASCADE,
  scores JSONB NOT NULL DEFAULT '{}', -- { "innovation": 4, "impact": 5, "feasibility": 3 }
  total_score INTEGER,
  comments TEXT,
  recommendation TEXT, -- fund, fund_with_conditions, decline
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 6. FINANCIAL LEDGER (Double-entry bookkeeping)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.gl_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  code TEXT NOT NULL, -- 4000, 4100, etc.
  name TEXT NOT NULL, -- Membership Revenue, Donation Revenue, etc.
  account_type TEXT NOT NULL, -- asset, liability, equity, revenue, expense
  parent_id UUID REFERENCES gl_accounts(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, code)
);

CREATE TABLE IF NOT EXISTS public.ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  transaction_id UUID NOT NULL, -- Groups debits and credits
  gl_account_id UUID NOT NULL REFERENCES gl_accounts(id),
  debit_cents INTEGER DEFAULT 0,
  credit_cents INTEGER DEFAULT 0,
  description TEXT,
  reference_type TEXT, -- payment, donation, refund, adjustment
  reference_id UUID,
  posted_at TIMESTAMPTZ DEFAULT now(),
  fiscal_year INTEGER,
  fiscal_period INTEGER,
  is_locked BOOLEAN DEFAULT false, -- Immutable after month-end close
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT valid_entry CHECK (
    (debit_cents > 0 AND credit_cents = 0) OR 
    (credit_cents > 0 AND debit_cents = 0)
  )
);

CREATE INDEX idx_ledger_entries_account ON ledger_entries(gl_account_id, posted_at);
CREATE INDEX idx_ledger_entries_transaction ON ledger_entries(transaction_id);
CREATE INDEX idx_ledger_entries_reference ON ledger_entries(reference_type, reference_id);

-- Add GL codes to existing tables
ALTER TABLE membership_plans ADD COLUMN IF NOT EXISTS gl_account_id UUID REFERENCES gl_accounts(id);
ALTER TABLE donation_campaigns ADD COLUMN IF NOT EXISTS gl_account_id UUID REFERENCES gl_accounts(id);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT false;

-- ============================================================================
-- 7. AI PREDICTIONS & EMBEDDINGS
-- ============================================================================
-- Enable pgvector if not already
CREATE EXTENSION IF NOT EXISTS vector;

-- Add AI columns to engagement scores
ALTER TABLE member_engagement_scores 
  ADD COLUMN IF NOT EXISTS predicted_churn_risk DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS churn_risk_factors JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS ai_recommendations JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS prediction_updated_at TIMESTAMPTZ;

-- Resource embeddings for recommendations
ALTER TABLE resources ADD COLUMN IF NOT EXISTS embedding vector(1536);
ALTER TABLE resources ADD COLUMN IF NOT EXISTS embedding_updated_at TIMESTAMPTZ;

-- Member interest embeddings
ALTER TABLE member_organizations ADD COLUMN IF NOT EXISTS interest_embedding vector(1536);

-- AI-generated content cache
CREATE TABLE IF NOT EXISTS public.ai_content_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  cache_key TEXT NOT NULL, -- e.g., "board_report_2024_01"
  content_type TEXT NOT NULL, -- summary, recommendation, email_draft
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, cache_key)
);

-- ============================================================================
-- 8. ZOOM INTEGRATION
-- ============================================================================
ALTER TABLE organizations 
  ADD COLUMN IF NOT EXISTS zoom_account_id TEXT,
  ADD COLUMN IF NOT EXISTS zoom_client_id TEXT,
  ADD COLUMN IF NOT EXISTS zoom_client_secret TEXT,
  ADD COLUMN IF NOT EXISTS zoom_access_token TEXT,
  ADD COLUMN IF NOT EXISTS zoom_refresh_token TEXT,
  ADD COLUMN IF NOT EXISTS zoom_token_expires_at TIMESTAMPTZ;

ALTER TABLE events 
  ADD COLUMN IF NOT EXISTS zoom_meeting_id TEXT,
  ADD COLUMN IF NOT EXISTS zoom_webinar_id TEXT,
  ADD COLUMN IF NOT EXISTS zoom_join_url TEXT,
  ADD COLUMN IF NOT EXISTS zoom_password TEXT,
  ADD COLUMN IF NOT EXISTS zoom_registrant_sync BOOLEAN DEFAULT false;

-- Attendance tracking from Zoom
CREATE TABLE IF NOT EXISTS public.event_attendance_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  registration_id UUID REFERENCES event_registrations(id),
  participant_email TEXT,
  participant_name TEXT,
  join_time TIMESTAMPTZ,
  leave_time TIMESTAMPTZ,
  duration_minutes INTEGER,
  source TEXT DEFAULT 'zoom', -- zoom, manual, qr_scan
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_attendance_logs_event ON event_attendance_logs(event_id);

-- ============================================================================
-- 9. QUICKBOOKS INTEGRATION
-- ============================================================================
ALTER TABLE organizations 
  ADD COLUMN IF NOT EXISTS quickbooks_realm_id TEXT,
  ADD COLUMN IF NOT EXISTS quickbooks_access_token TEXT,
  ADD COLUMN IF NOT EXISTS quickbooks_refresh_token TEXT,
  ADD COLUMN IF NOT EXISTS quickbooks_token_expires_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.quickbooks_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL, -- invoice, payment, customer
  local_id UUID NOT NULL,
  quickbooks_id TEXT,
  sync_direction TEXT NOT NULL, -- push, pull
  sync_status TEXT DEFAULT 'pending', -- pending, synced, failed
  error_message TEXT,
  synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_qb_sync_org ON quickbooks_sync_log(organization_id, entity_type);

-- ============================================================================
-- 10. MEMBERSHIP PRORATION
-- ============================================================================
ALTER TABLE membership_plans 
  ADD COLUMN IF NOT EXISTS proration_mode TEXT DEFAULT 'anniversary', -- anniversary, fiscal_year, calendar_year
  ADD COLUMN IF NOT EXISTS fiscal_year_start_month INTEGER DEFAULT 1, -- 1-12
  ADD COLUMN IF NOT EXISTS allow_mid_year_join BOOLEAN DEFAULT true;

-- ============================================================================
-- 11. CSV IMPORT TRACKING
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  import_type TEXT NOT NULL, -- members, donations, events
  file_name TEXT,
  total_rows INTEGER,
  processed_rows INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending', -- pending, processing, completed, failed
  column_mapping JSONB, -- { "source_col": "target_field" }
  errors JSONB DEFAULT '[]',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 12. BOARD REPORTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.board_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  report_period TEXT NOT NULL, -- 2024-Q1, 2024-01, etc.
  title TEXT NOT NULL,
  executive_summary TEXT, -- AI-generated
  sections JSONB NOT NULL DEFAULT '[]', -- [{ "title": "Membership", "content": "...", "charts": [...] }]
  generated_at TIMESTAMPTZ DEFAULT now(),
  pdf_url TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 13. FUNCTION: Process Event Bus
-- ============================================================================
CREATE OR REPLACE FUNCTION process_event_triggers()
RETURNS TRIGGER AS $$
DECLARE
  v_event_type TEXT;
  v_payload JSONB;
BEGIN
  -- Determine event type based on table and operation
  v_event_type := TG_TABLE_NAME || '_' || lower(TG_OP);
  
  -- Build payload
  IF TG_OP = 'DELETE' THEN
    v_payload := to_jsonb(OLD);
  ELSE
    v_payload := to_jsonb(NEW);
  END IF;
  
  -- Insert into event bus
  INSERT INTO event_bus (organization_id, event_type, payload)
  VALUES (
    COALESCE(NEW.organization_id, OLD.organization_id),
    v_event_type,
    v_payload
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 14. TRIGGERS: Event-driven automation
-- ============================================================================
-- Donations trigger
DROP TRIGGER IF EXISTS donations_event_trigger ON donations;
CREATE TRIGGER donations_event_trigger
  AFTER INSERT ON donations
  FOR EACH ROW EXECUTE FUNCTION process_event_triggers();

-- Payments trigger  
DROP TRIGGER IF EXISTS payments_event_trigger ON payments;
CREATE TRIGGER payments_event_trigger
  AFTER INSERT OR UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION process_event_triggers();

-- Member organizations trigger
DROP TRIGGER IF EXISTS member_orgs_event_trigger ON member_organizations;
CREATE TRIGGER member_orgs_event_trigger
  AFTER INSERT OR UPDATE ON member_organizations
  FOR EACH ROW EXECUTE FUNCTION process_event_triggers();

-- Event registrations trigger
DROP TRIGGER IF EXISTS registrations_event_trigger ON event_registrations;
CREATE TRIGGER registrations_event_trigger
  AFTER INSERT ON event_registrations
  FOR EACH ROW EXECUTE FUNCTION process_event_triggers();

-- ============================================================================
-- 15. FUNCTION: Check Grant Reviewer Conflicts
-- ============================================================================
CREATE OR REPLACE FUNCTION check_reviewer_conflicts(
  p_application_id UUID,
  p_reviewer_id UUID
) RETURNS TABLE(has_conflict BOOLEAN, reason TEXT) AS $$
DECLARE
  v_applicant_domain TEXT;
  v_applicant_org_id UUID;
  v_reviewer_domain TEXT;
  v_reviewer_org_name TEXT;
BEGIN
  -- Get applicant info
  SELECT 
    split_part(ga.contact_email, '@', 2),
    ga.applicant_organization_id
  INTO v_applicant_domain, v_applicant_org_id
  FROM grant_applications ga
  WHERE ga.id = p_application_id;
  
  -- Get reviewer info
  SELECT email_domain, organization_name
  INTO v_reviewer_domain, v_reviewer_org_name
  FROM grant_reviewers
  WHERE id = p_reviewer_id;
  
  -- Check domain match
  IF v_applicant_domain = v_reviewer_domain THEN
    RETURN QUERY SELECT true, 'Same email domain as applicant';
    RETURN;
  END IF;
  
  -- Check organization match (if reviewer org is known)
  IF v_reviewer_org_name IS NOT NULL THEN
    -- Could add fuzzy matching here
    RETURN QUERY SELECT false, NULL::TEXT;
    RETURN;
  END IF;
  
  RETURN QUERY SELECT false, NULL::TEXT;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 16. FUNCTION: Calculate Proration
-- ============================================================================
CREATE OR REPLACE FUNCTION calculate_prorated_amount(
  p_plan_id UUID,
  p_join_date DATE
) RETURNS INTEGER AS $$
DECLARE
  v_plan membership_plans%ROWTYPE;
  v_year_start DATE;
  v_year_end DATE;
  v_days_remaining INTEGER;
  v_total_days INTEGER;
  v_prorated_amount INTEGER;
BEGIN
  SELECT * INTO v_plan FROM membership_plans WHERE id = p_plan_id;
  
  IF v_plan.proration_mode = 'anniversary' THEN
    -- No proration for anniversary billing
    RETURN v_plan.price_cents;
  END IF;
  
  -- Calculate year boundaries based on proration mode
  IF v_plan.proration_mode = 'fiscal_year' THEN
    IF EXTRACT(MONTH FROM p_join_date) >= v_plan.fiscal_year_start_month THEN
      v_year_start := make_date(EXTRACT(YEAR FROM p_join_date)::INTEGER, v_plan.fiscal_year_start_month, 1);
      v_year_end := make_date(EXTRACT(YEAR FROM p_join_date)::INTEGER + 1, v_plan.fiscal_year_start_month, 1) - INTERVAL '1 day';
    ELSE
      v_year_start := make_date(EXTRACT(YEAR FROM p_join_date)::INTEGER - 1, v_plan.fiscal_year_start_month, 1);
      v_year_end := make_date(EXTRACT(YEAR FROM p_join_date)::INTEGER, v_plan.fiscal_year_start_month, 1) - INTERVAL '1 day';
    END IF;
  ELSE -- calendar_year
    v_year_start := make_date(EXTRACT(YEAR FROM p_join_date)::INTEGER, 1, 1);
    v_year_end := make_date(EXTRACT(YEAR FROM p_join_date)::INTEGER, 12, 31);
  END IF;
  
  v_total_days := v_year_end - v_year_start + 1;
  v_days_remaining := v_year_end - p_join_date + 1;
  
  v_prorated_amount := (v_plan.price_cents * v_days_remaining / v_total_days)::INTEGER;
  
  RETURN v_prorated_amount;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 17. MATCH RESOURCES FUNCTION (for AI recommendations)
-- ============================================================================
CREATE OR REPLACE FUNCTION match_resources(
  query_embedding vector(1536),
  match_count INTEGER DEFAULT 5,
  p_organization_id UUID DEFAULT NULL
) RETURNS TABLE(
  id UUID,
  title TEXT,
  description TEXT,
  similarity FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.id,
    r.title,
    r.description,
    1 - (r.embedding <=> query_embedding) as similarity
  FROM resources r
  WHERE r.embedding IS NOT NULL
    AND (p_organization_id IS NULL OR r.organization_id = p_organization_id)
  ORDER BY r.embedding <=> query_embedding
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 18. ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_bus ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE grant_reviewers ENABLE ROW LEVEL SECURITY;
ALTER TABLE grant_review_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE grant_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE gl_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_attendance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE quickbooks_sync_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE board_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_content_cache ENABLE ROW LEVEL SECURITY;

-- Add appropriate policies (example for webhooks)
CREATE POLICY webhooks_org_policy ON webhooks
  FOR ALL USING (organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  ));

