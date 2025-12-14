-- ============================================================================
-- MIGRATION 011: ENTERPRISE EXPANSION
-- Settings, Finance, Events, Volunteers, Documents, Developer Tools
-- ============================================================================

-- ============================================================================
-- PART 1: ORGANIZATION SETTINGS & TEAM
-- ============================================================================

-- Extend organizations table
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS logo_url TEXT,
ADD COLUMN IF NOT EXISTS brand_color TEXT DEFAULT '#166534',
ADD COLUMN IF NOT EXISTS secondary_color TEXT DEFAULT '#1e40af',
ADD COLUMN IF NOT EXISTS tax_id TEXT,
ADD COLUMN IF NOT EXISTS fiscal_year_start INTEGER DEFAULT 1, -- 1=Jan, 7=Jul
ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/Chicago',
ADD COLUMN IF NOT EXISTS address JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS contact_email TEXT,
ADD COLUMN IF NOT EXISTS contact_phone TEXT,
ADD COLUMN IF NOT EXISTS website_url TEXT,
ADD COLUMN IF NOT EXISTS social_links JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS features_enabled JSONB DEFAULT '{"events": true, "grants": true, "donations": true, "volunteers": true}',
ADD COLUMN IF NOT EXISTS email_settings JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS stripe_account_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_onboarding_complete BOOLEAN DEFAULT false;

-- Team invitations
CREATE TABLE IF NOT EXISTS team_invites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'editor', 'viewer', 'finance')),
  invited_by UUID REFERENCES auth.users(id),
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_team_invites_org ON team_invites(organization_id);
CREATE INDEX IF NOT EXISTS idx_team_invites_token ON team_invites(token);
CREATE INDEX IF NOT EXISTS idx_team_invites_email ON team_invites(email);

-- ============================================================================
-- PART 2: FUND ACCOUNTING
-- ============================================================================

CREATE TABLE IF NOT EXISTS funds (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  fund_type TEXT NOT NULL CHECK (fund_type IN ('unrestricted', 'temporarily_restricted', 'permanently_restricted')),
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  balance_cents BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, name)
);

CREATE INDEX IF NOT EXISTS idx_funds_org ON funds(organization_id);

-- Add fund_id to existing tables
ALTER TABLE donations ADD COLUMN IF NOT EXISTS fund_id UUID REFERENCES funds(id);
ALTER TABLE ledger_entries ADD COLUMN IF NOT EXISTS fund_id UUID REFERENCES funds(id);

-- ============================================================================
-- PART 3: BUDGETING
-- ============================================================================

CREATE TABLE IF NOT EXISTS budgets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  fiscal_year INTEGER NOT NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'closed')),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, fiscal_year, name)
);

CREATE TABLE IF NOT EXISTS budget_lines (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  budget_id UUID NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
  account_id UUID REFERENCES ledger_accounts(id),
  fund_id UUID REFERENCES funds(id),
  category TEXT NOT NULL,
  description TEXT,
  amount_cents BIGINT NOT NULL,
  period TEXT DEFAULT 'annual' CHECK (period IN ('annual', 'q1', 'q2', 'q3', 'q4', 'monthly')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_budget_lines_budget ON budget_lines(budget_id);

-- ============================================================================
-- PART 4: INVOICES
-- ============================================================================

CREATE TABLE IF NOT EXISTS invoices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  member_organization_id UUID REFERENCES member_organizations(id),
  invoice_number TEXT NOT NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'viewed', 'paid', 'partial', 'overdue', 'void', 'cancelled')),
  
  -- Billing details
  bill_to_name TEXT,
  bill_to_email TEXT,
  bill_to_address JSONB,
  
  -- Line items
  line_items JSONB NOT NULL DEFAULT '[]', -- [{description, quantity, unit_price_cents, total_cents, fund_id}]
  
  -- Amounts
  subtotal_cents BIGINT NOT NULL DEFAULT 0,
  tax_rate DECIMAL(5,4) DEFAULT 0,
  tax_cents BIGINT DEFAULT 0,
  discount_cents BIGINT DEFAULT 0,
  total_cents BIGINT NOT NULL DEFAULT 0,
  paid_cents BIGINT DEFAULT 0,
  balance_cents BIGINT GENERATED ALWAYS AS (total_cents - paid_cents) STORED,
  
  -- Dates
  issue_date DATE DEFAULT CURRENT_DATE,
  due_date DATE,
  paid_at TIMESTAMPTZ,
  
  -- Payment
  stripe_invoice_id TEXT,
  payment_link TEXT,
  
  -- Documents
  pdf_url TEXT,
  
  -- Metadata
  notes TEXT,
  internal_notes TEXT,
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  sent_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(organization_id, invoice_number)
);

CREATE INDEX IF NOT EXISTS idx_invoices_org ON invoices(organization_id);
CREATE INDEX IF NOT EXISTS idx_invoices_member ON invoices(member_organization_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date);

-- Invoice payments (for partial payments)
CREATE TABLE IF NOT EXISTS invoice_payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  payment_id UUID REFERENCES payments(id),
  amount_cents BIGINT NOT NULL,
  payment_method TEXT,
  payment_date DATE DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Invoice sequence for auto-numbering
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1000;

-- ============================================================================
-- PART 5: ADVANCED EVENTS
-- ============================================================================

-- Event sessions/tracks for conferences
CREATE TABLE IF NOT EXISTS event_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  session_type TEXT DEFAULT 'session' CHECK (session_type IN ('session', 'workshop', 'keynote', 'break', 'networking', 'meal')),
  track TEXT, -- e.g., "Technical", "Policy", "Beginner"
  
  -- Schedule
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  
  -- Location
  room TEXT,
  is_virtual BOOLEAN DEFAULT false,
  virtual_link TEXT,
  
  -- Capacity
  capacity INTEGER,
  registered_count INTEGER DEFAULT 0,
  
  -- Speakers
  speakers JSONB DEFAULT '[]', -- [{name, title, bio, photo_url}]
  
  -- Materials
  materials JSONB DEFAULT '[]', -- [{name, url, type}]
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_sessions_event ON event_sessions(event_id);

-- Event waitlist
CREATE TABLE IF NOT EXISTS event_waitlist (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  session_id UUID REFERENCES event_sessions(id) ON DELETE CASCADE,
  attendee_email TEXT NOT NULL,
  attendee_name TEXT,
  member_organization_id UUID REFERENCES member_organizations(id),
  position INTEGER,
  promoted_at TIMESTAMPTZ,
  expired_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, session_id, attendee_email)
);

-- Event sponsors
CREATE TABLE IF NOT EXISTS event_sponsors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  
  -- Sponsor details
  sponsor_name TEXT NOT NULL,
  sponsor_logo_url TEXT,
  sponsor_website TEXT,
  sponsor_description TEXT,
  
  -- Tier and benefits
  tier TEXT NOT NULL CHECK (tier IN ('title', 'platinum', 'gold', 'silver', 'bronze', 'supporter', 'in_kind')),
  tier_order INTEGER DEFAULT 99,
  amount_cents BIGINT,
  benefits JSONB DEFAULT '[]', -- [{benefit, fulfilled}]
  
  -- Contact
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  
  -- Tracking
  invoice_id UUID REFERENCES invoices(id),
  payment_status TEXT DEFAULT 'pending',
  
  -- Display
  is_featured BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_sponsors_event ON event_sponsors(event_id);

-- Event promo codes
CREATE TABLE IF NOT EXISTS event_promo_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value INTEGER NOT NULL, -- percentage (0-100) or cents
  max_uses INTEGER,
  uses_count INTEGER DEFAULT 0,
  valid_from TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, code)
);

-- Extend events table
ALTER TABLE events
ADD COLUMN IF NOT EXISTS waitlist_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS waitlist_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_multi_session BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS allow_session_selection BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS survey_url TEXT,
ADD COLUMN IF NOT EXISTS recording_url TEXT,
ADD COLUMN IF NOT EXISTS materials JSONB DEFAULT '[]';

-- Extend event_registrations
ALTER TABLE event_registrations
ADD COLUMN IF NOT EXISTS session_ids JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS promo_code_id UUID REFERENCES event_promo_codes(id),
ADD COLUMN IF NOT EXISTS discount_cents BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS check_in_time TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS dietary_restrictions TEXT,
ADD COLUMN IF NOT EXISTS accessibility_needs TEXT,
ADD COLUMN IF NOT EXISTS survey_completed BOOLEAN DEFAULT false;

-- ============================================================================
-- PART 6: VOLUNTEER MANAGEMENT
-- ============================================================================

CREATE TABLE IF NOT EXISTS volunteer_opportunities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  
  -- Details
  title TEXT NOT NULL,
  description TEXT,
  
  -- Schedule
  date_start TIMESTAMPTZ NOT NULL,
  date_end TIMESTAMPTZ,
  shift_duration_hours DECIMAL(4,2),
  
  -- Location
  location TEXT,
  is_virtual BOOLEAN DEFAULT false,
  virtual_link TEXT,
  
  -- Requirements
  required_volunteers INTEGER DEFAULT 1,
  signed_up_count INTEGER DEFAULT 0,
  skills_needed TEXT[] DEFAULT '{}',
  min_age INTEGER,
  requirements TEXT,
  
  -- Status
  status TEXT DEFAULT 'published' CHECK (status IN ('draft', 'published', 'cancelled', 'completed')),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_volunteer_opps_org ON volunteer_opportunities(organization_id);
CREATE INDEX IF NOT EXISTS idx_volunteer_opps_event ON volunteer_opportunities(event_id);
CREATE INDEX IF NOT EXISTS idx_volunteer_opps_date ON volunteer_opportunities(date_start);

CREATE TABLE IF NOT EXISTS volunteer_signups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  opportunity_id UUID NOT NULL REFERENCES volunteer_opportunities(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  member_organization_id UUID REFERENCES member_organizations(id),
  
  -- Volunteer info (for non-members)
  volunteer_name TEXT,
  volunteer_email TEXT,
  volunteer_phone TEXT,
  
  -- Status
  status TEXT DEFAULT 'confirmed' CHECK (status IN ('pending', 'confirmed', 'completed', 'no_show', 'cancelled')),
  
  -- Hours
  hours_logged DECIMAL(5,2) DEFAULT 0,
  hours_approved BOOLEAN DEFAULT false,
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  
  -- Notes
  notes TEXT,
  
  signed_up_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(opportunity_id, COALESCE(user_id, volunteer_email))
);

CREATE INDEX IF NOT EXISTS idx_volunteer_signups_opp ON volunteer_signups(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_volunteer_signups_user ON volunteer_signups(user_id);

CREATE TABLE IF NOT EXISTS volunteer_hours (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  member_organization_id UUID REFERENCES member_organizations(id),
  opportunity_id UUID REFERENCES volunteer_opportunities(id),
  signup_id UUID REFERENCES volunteer_signups(id),
  
  -- Hours
  hours DECIMAL(5,2) NOT NULL,
  date DATE NOT NULL,
  description TEXT,
  
  -- Approval
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_volunteer_hours_org ON volunteer_hours(organization_id);
CREATE INDEX IF NOT EXISTS idx_volunteer_hours_user ON volunteer_hours(user_id);

-- Volunteer badges/recognition
CREATE TABLE IF NOT EXISTS volunteer_badges (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  color TEXT DEFAULT '#f59e0b',
  criteria_type TEXT CHECK (criteria_type IN ('hours', 'events', 'manual')),
  criteria_value INTEGER, -- hours threshold or event count
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS volunteer_badge_awards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  badge_id UUID NOT NULL REFERENCES volunteer_badges(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  member_organization_id UUID REFERENCES member_organizations(id),
  awarded_at TIMESTAMPTZ DEFAULT NOW(),
  awarded_by UUID REFERENCES auth.users(id),
  notes TEXT
);

-- ============================================================================
-- PART 7: DOCUMENT LIBRARY
-- ============================================================================

CREATE TABLE IF NOT EXISTS document_folders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES document_folders(id),
  name TEXT NOT NULL,
  description TEXT,
  visibility TEXT DEFAULT 'members' CHECK (visibility IN ('public', 'members', 'admin', 'board')),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES document_folders(id),
  
  -- Document info
  title TEXT NOT NULL,
  description TEXT,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size_bytes BIGINT,
  mime_type TEXT,
  
  -- Categorization
  document_type TEXT, -- 'policy', 'minutes', 'report', 'form', 'certificate', 'receipt'
  tags TEXT[] DEFAULT '{}',
  
  -- Visibility
  visibility TEXT DEFAULT 'members' CHECK (visibility IN ('public', 'members', 'admin', 'board')),
  
  -- Version control
  version INTEGER DEFAULT 1,
  previous_version_id UUID REFERENCES documents(id),
  
  -- Metadata
  uploaded_by UUID REFERENCES auth.users(id),
  download_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_documents_org ON documents(organization_id);
CREATE INDEX IF NOT EXISTS idx_documents_folder ON documents(folder_id);

-- ============================================================================
-- PART 8: EMAIL TEMPLATES
-- ============================================================================

CREATE TABLE IF NOT EXISTS email_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Template info
  name TEXT NOT NULL,
  slug TEXT NOT NULL, -- 'welcome', 'renewal_reminder', 'event_confirmation', etc.
  description TEXT,
  
  -- Content
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT,
  
  -- Design
  header_image_url TEXT,
  footer_html TEXT,
  
  -- Variables
  available_variables JSONB DEFAULT '[]', -- [{name, description, example}]
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  is_system BOOLEAN DEFAULT false, -- System templates can't be deleted
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(organization_id, slug)
);

-- ============================================================================
-- PART 9: COMMUNICATION PREFERENCES
-- ============================================================================

CREATE TABLE IF NOT EXISTS communication_preferences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  member_organization_id UUID REFERENCES member_organizations(id),
  email TEXT,
  
  -- Email preferences
  email_frequency TEXT DEFAULT 'immediate' CHECK (email_frequency IN ('immediate', 'daily', 'weekly', 'none')),
  
  -- Topic preferences
  topic_events BOOLEAN DEFAULT true,
  topic_news BOOLEAN DEFAULT true,
  topic_grants BOOLEAN DEFAULT true,
  topic_volunteer BOOLEAN DEFAULT true,
  topic_membership BOOLEAN DEFAULT true,
  topic_fundraising BOOLEAN DEFAULT true,
  
  -- Channel preferences
  sms_enabled BOOLEAN DEFAULT false,
  sms_phone TEXT,
  
  -- Unsubscribe
  unsubscribed_at TIMESTAMPTZ,
  unsubscribe_reason TEXT,
  
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(organization_id, COALESCE(user_id::text, email))
);

-- ============================================================================
-- PART 10: WEBHOOKS & API
-- ============================================================================

CREATE TABLE IF NOT EXISTS webhook_endpoints (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Endpoint
  url TEXT NOT NULL,
  description TEXT,
  
  -- Authentication
  secret TEXT DEFAULT encode(gen_random_bytes(32), 'hex'),
  
  -- Events
  events TEXT[] NOT NULL DEFAULT '{}', -- ['member.created', 'donation.received', etc.]
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Stats
  last_triggered_at TIMESTAMPTZ,
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  endpoint_id UUID NOT NULL REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
  
  -- Event
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  
  -- Response
  status_code INTEGER,
  response_body TEXT,
  response_time_ms INTEGER,
  
  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed', 'retrying')),
  attempts INTEGER DEFAULT 0,
  next_retry_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_endpoint ON webhook_deliveries(endpoint_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_status ON webhook_deliveries(status);

-- API Keys
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Key info
  name TEXT NOT NULL,
  key_prefix TEXT NOT NULL, -- First 8 chars for display
  key_hash TEXT NOT NULL, -- Hashed full key
  
  -- Permissions
  scopes TEXT[] DEFAULT '{}', -- ['read:members', 'write:events', etc.]
  
  -- Restrictions
  allowed_ips TEXT[],
  rate_limit_per_hour INTEGER DEFAULT 1000,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  
  -- Stats
  request_count BIGINT DEFAULT 0,
  
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- PART 11: FINANCIAL REPORTS CACHE
-- ============================================================================

CREATE TABLE IF NOT EXISTS financial_report_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL, -- 'balance_sheet', 'income_statement', 'cash_flow', '990_prep'
  fiscal_year INTEGER NOT NULL,
  period TEXT, -- 'annual', 'q1', 'q2', 'q3', 'q4', 'month_01', etc.
  fund_id UUID REFERENCES funds(id),
  
  -- Report data
  report_data JSONB NOT NULL,
  
  -- Cache info
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '1 hour'),
  
  UNIQUE(organization_id, report_type, fiscal_year, period, fund_id)
);

-- ============================================================================
-- PART 12: OFFLINE SYNC QUEUE
-- ============================================================================

CREATE TABLE IF NOT EXISTS offline_sync_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  
  -- Action details
  action_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  
  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  attempts INTEGER DEFAULT 0,
  error_message TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_offline_sync_status ON offline_sync_queue(status);

-- ============================================================================
-- PART 13: RLS POLICIES
-- ============================================================================

ALTER TABLE team_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE funds ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_sponsors ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE volunteer_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE volunteer_signups ENABLE ROW LEVEL SECURITY;
ALTER TABLE volunteer_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE volunteer_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE volunteer_badge_awards ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE communication_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_endpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_report_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE offline_sync_queue ENABLE ROW LEVEL SECURITY;

-- Use existing RLS helper functions from migration 009
-- Policies for org members
CREATE POLICY "Org members can view" ON funds FOR SELECT USING (is_org_member(organization_id));
CREATE POLICY "Admins can manage funds" ON funds FOR ALL USING (is_org_admin(organization_id));

CREATE POLICY "Org members can view budgets" ON budgets FOR SELECT USING (is_org_member(organization_id));
CREATE POLICY "Finance can manage budgets" ON budgets FOR ALL USING (has_finance_access(organization_id));

CREATE POLICY "Org members can view invoices" ON invoices FOR SELECT USING (is_org_member(organization_id));
CREATE POLICY "Finance can manage invoices" ON invoices FOR ALL USING (has_finance_access(organization_id));

CREATE POLICY "Org members can view sessions" ON event_sessions FOR SELECT USING (
  EXISTS (SELECT 1 FROM events WHERE events.id = event_sessions.event_id AND is_org_member(events.organization_id))
);

CREATE POLICY "Org members can view opportunities" ON volunteer_opportunities FOR SELECT USING (is_org_member(organization_id));
CREATE POLICY "Admins can manage opportunities" ON volunteer_opportunities FOR ALL USING (is_org_admin(organization_id));

CREATE POLICY "Users can view own signups" ON volunteer_signups FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Admins can manage signups" ON volunteer_signups FOR ALL USING (
  EXISTS (SELECT 1 FROM volunteer_opportunities WHERE id = volunteer_signups.opportunity_id AND is_org_admin(organization_id))
);

CREATE POLICY "Org members can view documents" ON documents FOR SELECT USING (is_org_member(organization_id));
CREATE POLICY "Admins can manage documents" ON documents FOR ALL USING (is_org_admin(organization_id));

CREATE POLICY "Admins can manage webhooks" ON webhook_endpoints FOR ALL USING (is_org_admin(organization_id));
CREATE POLICY "Admins can view deliveries" ON webhook_deliveries FOR SELECT USING (
  EXISTS (SELECT 1 FROM webhook_endpoints WHERE id = webhook_deliveries.endpoint_id AND is_org_admin(organization_id))
);

CREATE POLICY "Admins can manage API keys" ON api_keys FOR ALL USING (is_org_admin(organization_id));

-- ============================================================================
-- PART 14: HELPER FUNCTIONS
-- ============================================================================

-- Generate invoice number
CREATE OR REPLACE FUNCTION generate_invoice_number(org_id UUID)
RETURNS TEXT AS $$
DECLARE
  prefix TEXT;
  seq_num INTEGER;
BEGIN
  SELECT COALESCE(SUBSTRING(name FROM 1 FOR 3), 'INV') INTO prefix FROM organizations WHERE id = org_id;
  seq_num := nextval('invoice_number_seq');
  RETURN UPPER(prefix) || '-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-' || LPAD(seq_num::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- Calculate total volunteer hours for user
CREATE OR REPLACE FUNCTION get_volunteer_hours(p_user_id UUID, p_org_id UUID DEFAULT NULL)
RETURNS DECIMAL AS $$
DECLARE
  total DECIMAL;
BEGIN
  SELECT COALESCE(SUM(hours), 0) INTO total
  FROM volunteer_hours
  WHERE user_id = p_user_id
    AND status = 'approved'
    AND (p_org_id IS NULL OR organization_id = p_org_id);
  RETURN total;
END;
$$ LANGUAGE plpgsql;

-- Check and award volunteer badges
CREATE OR REPLACE FUNCTION check_volunteer_badges(p_user_id UUID, p_org_id UUID)
RETURNS VOID AS $$
DECLARE
  total_hours DECIMAL;
  badge RECORD;
BEGIN
  total_hours := get_volunteer_hours(p_user_id, p_org_id);
  
  FOR badge IN 
    SELECT * FROM volunteer_badges 
    WHERE organization_id = p_org_id 
      AND criteria_type = 'hours'
      AND criteria_value <= total_hours
  LOOP
    INSERT INTO volunteer_badge_awards (badge_id, user_id)
    VALUES (badge.id, p_user_id)
    ON CONFLICT DO NOTHING;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Promote from waitlist
CREATE OR REPLACE FUNCTION promote_from_waitlist(p_event_id UUID)
RETURNS INTEGER AS $$
DECLARE
  promoted_count INTEGER := 0;
  event_record RECORD;
  waitlist_entry RECORD;
  available_spots INTEGER;
BEGIN
  SELECT * INTO event_record FROM events WHERE id = p_event_id;
  
  IF event_record.capacity IS NULL THEN
    RETURN 0;
  END IF;
  
  SELECT event_record.capacity - COUNT(*) INTO available_spots
  FROM event_registrations
  WHERE event_id = p_event_id AND status IN ('registered', 'checked_in');
  
  FOR waitlist_entry IN
    SELECT * FROM event_waitlist
    WHERE event_id = p_event_id AND promoted_at IS NULL AND expired_at IS NULL
    ORDER BY position, created_at
    LIMIT available_spots
  LOOP
    -- Create registration
    INSERT INTO event_registrations (
      organization_id, event_id, attendee_email, attendee_name, 
      member_organization_id, status, amount_cents
    ) VALUES (
      event_record.organization_id, p_event_id, waitlist_entry.attendee_email,
      waitlist_entry.attendee_name, waitlist_entry.member_organization_id,
      'registered', event_record.price_cents
    );
    
    -- Mark as promoted
    UPDATE event_waitlist SET promoted_at = NOW() WHERE id = waitlist_entry.id;
    
    promoted_count := promoted_count + 1;
  END LOOP;
  
  RETURN promoted_count;
END;
$$ LANGUAGE plpgsql;

-- Update invoice totals
CREATE OR REPLACE FUNCTION update_invoice_totals()
RETURNS TRIGGER AS $$
DECLARE
  items JSONB;
  subtotal BIGINT := 0;
  item JSONB;
BEGIN
  items := NEW.line_items;
  
  FOR item IN SELECT * FROM jsonb_array_elements(items)
  LOOP
    subtotal := subtotal + COALESCE((item->>'total_cents')::BIGINT, 0);
  END LOOP;
  
  NEW.subtotal_cents := subtotal;
  NEW.tax_cents := ROUND(subtotal * NEW.tax_rate);
  NEW.total_cents := subtotal + NEW.tax_cents - COALESCE(NEW.discount_cents, 0);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_invoice_totals
BEFORE INSERT OR UPDATE OF line_items, tax_rate, discount_cents ON invoices
FOR EACH ROW EXECUTE FUNCTION update_invoice_totals();

-- ============================================================================
-- PART 15: SEED DEFAULT DATA
-- ============================================================================

-- Insert default volunteer badges (will run once per org via application)
-- INSERT INTO volunteer_badges (organization_id, name, description, criteria_type, criteria_value, icon, color)
-- VALUES 
--   (org_id, 'Rising Star', '10+ volunteer hours', 'hours', 10, 'star', '#fbbf24'),
--   (org_id, 'Dedicated Volunteer', '50+ volunteer hours', 'hours', 50, 'award', '#f59e0b'),
--   (org_id, 'Century Club', '100+ volunteer hours', 'hours', 100, 'trophy', '#ef4444');

COMMIT;
