-- Migration 015: AI Migration Engine
-- Multi-LLM ensemble mapping, agentic migration, learning loop

-- =====================================================
-- PART 1: DATA MIGRATIONS (Session Tracking)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.data_migrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id),
  
  -- Source Info
  source_system TEXT, -- 'wild_apricot', 'memberclicks', 'csv', 'excel', 'imis', etc.
  source_file_name TEXT,
  file_url TEXT,
  file_size_bytes BIGINT,
  
  -- Parsed Data
  parsed_sample JSONB, -- First 100 rows for AI analysis
  detected_columns TEXT[],
  detected_row_count INT,
  
  -- AI Mapping Results
  mapping JSONB, -- { "source_field": "target_table.target_field" }
  confidence_by_field JSONB, -- { "source_field": 0.95 }
  conflicts JSONB, -- Array of conflict objects
  ai_confidence NUMERIC(3,2), -- Overall 0-1 confidence
  
  -- Multi-LLM Ensemble Details
  ensemble_proposals JSONB, -- Raw proposals from each model
  ensemble_votes JSONB, -- Voting breakdown
  
  -- Processing Status
  status TEXT DEFAULT 'uploaded', -- uploaded, analyzing, mapping, needs_review, ready_to_import, importing, complete, failed
  current_step TEXT,
  progress_percent INT DEFAULT 0,
  
  -- Import Stats
  stats JSONB DEFAULT '{}'::jsonb, -- rows_imported, duplicates_merged, errors, etc.
  import_started_at TIMESTAMPTZ,
  import_completed_at TIMESTAMPTZ,
  
  -- Post-Migration
  post_migration_report TEXT, -- AI-generated insights
  welcome_emails_sent INT DEFAULT 0,
  automations_created INT DEFAULT 0,
  tags_applied INT DEFAULT 0,
  
  -- Error Handling
  error_log TEXT,
  retry_count INT DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_migrations_org ON public.data_migrations(organization_id, created_at DESC);
CREATE INDEX idx_migrations_status ON public.data_migrations(status);

-- =====================================================
-- PART 2: MIGRATION LEARNING (Continuous Improvement)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.migration_learnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- What was learned
  source_system TEXT, -- Which AMS
  source_field TEXT, -- Original column name
  target_path TEXT, -- Where it mapped to
  
  -- Outcome tracking
  was_correct BOOLEAN, -- Did user accept or override?
  user_override TEXT, -- What they changed it to
  confidence_at_suggestion NUMERIC(3,2),
  
  -- Context
  sample_values TEXT[], -- Example data that helped
  reasoning TEXT, -- AI explanation
  
  -- Learning metadata
  org_type TEXT, -- 'membership', 'foundation', 'association'
  migration_id UUID REFERENCES public.data_migrations(id),
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_learnings_lookup ON public.migration_learnings(source_system, source_field);

-- =====================================================
-- PART 3: MIGRATION FIELD MAPPINGS (Canonical Reference)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.migration_field_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Source patterns (what we've seen)
  source_system TEXT NOT NULL,
  source_field_pattern TEXT NOT NULL, -- Regex or exact match
  source_field_examples TEXT[],
  
  -- Target mapping
  target_table TEXT NOT NULL,
  target_field TEXT NOT NULL,
  
  -- Confidence from historical data
  historical_accuracy NUMERIC(3,2) DEFAULT 0.50,
  usage_count INT DEFAULT 0,
  
  -- Metadata
  is_verified BOOLEAN DEFAULT false,
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(source_system, source_field_pattern)
);

-- Seed common mappings
INSERT INTO public.migration_field_catalog (source_system, source_field_pattern, source_field_examples, target_table, target_field, historical_accuracy, is_verified) VALUES
-- Wild Apricot patterns
('wild_apricot', 'First name', ARRAY['First name', 'FirstName'], 'profiles', 'first_name', 0.99, true),
('wild_apricot', 'Last name', ARRAY['Last name', 'LastName'], 'profiles', 'last_name', 0.99, true),
('wild_apricot', 'Email', ARRAY['Email', 'E-mail', 'email'], 'profiles', 'email', 0.99, true),
('wild_apricot', 'Member since', ARRAY['Member since', 'MemberSince', 'Join Date'], 'member_organizations', 'joined_at', 0.95, true),
('wild_apricot', 'Membership level', ARRAY['Membership level', 'Level', 'Membership Type'], 'member_organizations', 'membership_type_id', 0.90, true),
-- MemberClicks patterns
('memberclicks', 'FirstName', ARRAY['FirstName', 'First_Name'], 'profiles', 'first_name', 0.99, true),
('memberclicks', 'LastName', ARRAY['LastName', 'Last_Name'], 'profiles', 'last_name', 0.99, true),
('memberclicks', 'PrimaryEmail', ARRAY['PrimaryEmail', 'Email1'], 'profiles', 'email', 0.99, true),
-- Generic CSV patterns
('csv', 'name', ARRAY['name', 'Name', 'full_name', 'Full Name', 'FullName'], 'profiles', 'full_name', 0.95, true),
('csv', 'email', ARRAY['email', 'Email', 'E-mail', 'EMAIL', 'e_mail'], 'profiles', 'email', 0.99, true),
('csv', 'phone', ARRAY['phone', 'Phone', 'telephone', 'Telephone', 'mobile'], 'profiles', 'phone', 0.95, true),
('csv', 'company', ARRAY['company', 'Company', 'organization', 'Organization', 'employer'], 'profiles', 'company', 0.90, true),
('csv', 'amount', ARRAY['amount', 'Amount', 'donation_amount', 'gift_amount', 'total'], 'donations', 'amount_cents', 0.85, true)
ON CONFLICT DO NOTHING;

-- =====================================================
-- PART 4: RLS POLICIES
-- =====================================================

ALTER TABLE public.data_migrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.migration_learnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org admins manage migrations" ON public.data_migrations
  FOR ALL USING (is_org_admin(organization_id));

CREATE POLICY "System reads learnings" ON public.migration_learnings
  FOR SELECT USING (true);

-- =====================================================
-- PART 5: FOUNDATIONOS SCHEMA REFERENCE (for AI)
-- =====================================================

-- This view helps AI understand the target schema
CREATE OR REPLACE VIEW public.migration_target_schema AS
SELECT 
  'profiles' as table_name,
  ARRAY['id', 'email', 'full_name', 'first_name', 'last_name', 'phone', 'company', 'job_title', 'bio', 'avatar_url', 'address_line1', 'address_line2', 'city', 'state', 'zip', 'country'] as columns,
  'Member/contact profile information' as description
UNION ALL
SELECT 
  'member_organizations',
  ARRAY['id', 'organization_id', 'organization_name', 'primary_contact_email', 'membership_type_id', 'status', 'joined_at', 'expires_at', 'external_id'],
  'Membership records linking contacts to organization'
UNION ALL
SELECT 
  'donations',
  ARRAY['id', 'organization_id', 'donor_profile_id', 'donor_email', 'donor_name', 'amount_cents', 'currency', 'status', 'fund_id', 'campaign_id', 'is_recurring', 'is_anonymous', 'tribute_type', 'tribute_name', 'notes'],
  'Donation/gift records'
UNION ALL
SELECT 
  'events',
  ARRAY['id', 'organization_id', 'title', 'description', 'date_start', 'date_end', 'location', 'venue_name', 'is_virtual', 'virtual_url', 'capacity', 'price_cents'],
  'Event records'
UNION ALL
SELECT 
  'event_registrations',
  ARRAY['id', 'event_id', 'profile_id', 'status', 'ticket_type', 'amount_paid_cents', 'checked_in_at'],
  'Event registration/attendance records';
