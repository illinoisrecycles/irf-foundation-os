-- Migration 012: AI Grants Engine, Impact Reporting, Enhanced Features
-- FoundationOS Enterprise Expansion Part 2

-- =====================================================
-- PART 1: EXTERNAL GRANT OPPORTUNITIES (AI Discovery)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.external_grant_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  external_id TEXT, -- Grants.gov opportunity ID
  source_type TEXT DEFAULT 'federal', -- federal, state, private_foundation, community
  title TEXT NOT NULL,
  synopsis TEXT,
  agency TEXT,
  funder_name TEXT,
  deadline TIMESTAMPTZ,
  estimated_funding BIGINT,
  min_award BIGINT,
  max_award BIGINT,
  match_score NUMERIC(3,2), -- AI-calculated 0.00-1.00
  status TEXT DEFAULT 'discovered', -- discovered, recommended, high_priority, drafting, applied, rejected, won
  application_url TEXT,
  eligibility_notes TEXT,
  application_draft JSONB, -- AI-generated draft
  raw_data JSONB, -- Full API response
  notes TEXT,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(external_id, organization_id)
);

CREATE INDEX idx_external_grants_org ON public.external_grant_opportunities(organization_id);
CREATE INDEX idx_external_grants_status ON public.external_grant_opportunities(status);
CREATE INDEX idx_external_grants_deadline ON public.external_grant_opportunities(deadline);
CREATE INDEX idx_external_grants_score ON public.external_grant_opportunities(match_score DESC);

-- =====================================================
-- PART 2: GRANT APPLICATION AI SUMMARIES
-- =====================================================

ALTER TABLE public.grant_applications 
  ADD COLUMN IF NOT EXISTS ai_summary TEXT,
  ADD COLUMN IF NOT EXISTS ai_summary_generated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ai_risk_flags JSONB,
  ADD COLUMN IF NOT EXISTS ai_strength_highlights JSONB,
  ADD COLUMN IF NOT EXISTS average_score NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS total_reviews INT DEFAULT 0;

-- =====================================================
-- PART 3: PROGRAMS & IMPACT REPORTING
-- =====================================================

CREATE TABLE IF NOT EXISTS public.programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  start_date DATE,
  end_date DATE,
  goal TEXT,
  budget_cents BIGINT,
  status TEXT DEFAULT 'active', -- planning, active, completed, suspended
  program_type TEXT, -- direct_service, education, advocacy, research, grant_funded
  grant_id UUID REFERENCES public.grant_applications(id), -- Link to funding source
  lead_staff_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.outcome_indicators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID REFERENCES public.programs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  indicator_type TEXT NOT NULL, -- numeric, percentage, count, currency, boolean
  target_value NUMERIC,
  unit TEXT, -- e.g., "tons", "people", "hours", "$"
  frequency TEXT DEFAULT 'quarterly', -- daily, weekly, monthly, quarterly, annually
  data_source TEXT, -- manual, automated, survey, external
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.beneficiaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  program_id UUID REFERENCES public.programs(id),
  external_id TEXT, -- For anonymization or external system reference
  name TEXT, -- Can be anonymous
  email TEXT,
  phone TEXT,
  demographics JSONB, -- age, gender, location, income_level, etc.
  enrollment_date DATE,
  exit_date DATE,
  status TEXT DEFAULT 'active', -- active, completed, dropped, graduated
  services_received JSONB, -- Array of {service_type, date, notes}
  outcomes JSONB, -- Tracked outcomes for this beneficiary
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.outcome_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  indicator_id UUID REFERENCES public.outcome_indicators(id) ON DELETE CASCADE,
  program_id UUID REFERENCES public.programs(id),
  value NUMERIC NOT NULL,
  reported_date DATE NOT NULL,
  period_start DATE,
  period_end DATE,
  notes TEXT,
  data_source TEXT,
  verified BOOLEAN DEFAULT false,
  verified_by UUID REFERENCES auth.users(id),
  verified_at TIMESTAMPTZ,
  reported_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_programs_org ON public.programs(organization_id);
CREATE INDEX idx_indicators_program ON public.outcome_indicators(program_id);
CREATE INDEX idx_beneficiaries_program ON public.beneficiaries(program_id);
CREATE INDEX idx_outcome_data_indicator ON public.outcome_data(indicator_id);
CREATE INDEX idx_outcome_data_date ON public.outcome_data(reported_date);

-- =====================================================
-- PART 4: BOARD PORTAL ENHANCEMENTS
-- =====================================================

-- Board meeting attendance/RSVP
CREATE TABLE IF NOT EXISTS public.board_meeting_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID REFERENCES public.board_meetings(id) ON DELETE CASCADE,
  member_id UUID REFERENCES auth.users(id),
  rsvp_status TEXT DEFAULT 'pending', -- pending, attending, declined, tentative
  attended BOOLEAN,
  notes TEXT,
  rsvp_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Board votes
CREATE TABLE IF NOT EXISTS public.board_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  meeting_id UUID REFERENCES public.board_meetings(id),
  title TEXT NOT NULL,
  description TEXT,
  vote_type TEXT DEFAULT 'yes_no', -- yes_no, multiple_choice, ranked
  options JSONB, -- For multiple choice: [{id, label}]
  requires_quorum BOOLEAN DEFAULT true,
  quorum_percentage INT DEFAULT 50,
  closes_at TIMESTAMPTZ,
  status TEXT DEFAULT 'open', -- draft, open, closed
  results JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.board_vote_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vote_id UUID REFERENCES public.board_votes(id) ON DELETE CASCADE,
  member_id UUID REFERENCES auth.users(id),
  response TEXT NOT NULL, -- yes, no, abstain, or option_id
  voted_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(vote_id, member_id)
);

-- Board action items
CREATE TABLE IF NOT EXISTS public.board_action_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  meeting_id UUID REFERENCES public.board_meetings(id),
  title TEXT NOT NULL,
  description TEXT,
  assigned_to UUID REFERENCES auth.users(id),
  due_date DATE,
  status TEXT DEFAULT 'pending', -- pending, in_progress, completed, cancelled
  priority TEXT DEFAULT 'medium', -- low, medium, high, urgent
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- PART 5: GRANTEE PORTAL TABLES
-- =====================================================

-- Grant reports (from grantees)
CREATE TABLE IF NOT EXISTS public.grant_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID REFERENCES public.grant_applications(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL, -- progress, final, financial, impact
  period_start DATE,
  period_end DATE,
  due_date DATE,
  submitted_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending', -- pending, submitted, approved, revision_requested
  narrative TEXT,
  financials JSONB, -- {budget_spent, remaining, line_items}
  outcomes JSONB, -- {indicator_id, achieved_value}
  attachments JSONB, -- [{name, url}]
  reviewer_notes TEXT,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- PART 6: RSS FEED SOURCES FOR GRANT DISCOVERY
-- =====================================================

CREATE TABLE IF NOT EXISTS public.grant_rss_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id), -- NULL = global
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  source_type TEXT DEFAULT 'state', -- federal, state, private, aggregator
  is_active BOOLEAN DEFAULT true,
  last_fetched_at TIMESTAMPTZ,
  fetch_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- PART 7: ORGANIZATION PROFILE ENHANCEMENTS
-- =====================================================

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS focus_areas TEXT[], -- e.g., ['recycling', 'education', 'environment']
  ADD COLUMN IF NOT EXISTS service_area TEXT, -- geographic focus
  ADD COLUMN IF NOT EXISTS founding_year INT,
  ADD COLUMN IF NOT EXISTS annual_budget_range TEXT, -- '<100k', '100k-500k', '500k-1m', '1m-5m', '5m+'
  ADD COLUMN IF NOT EXISTS staff_count INT,
  ADD COLUMN IF NOT EXISTS mission_statement TEXT,
  ADD COLUMN IF NOT EXISTS impact_summary TEXT, -- AI-generated or manual
  ADD COLUMN IF NOT EXISTS grant_preferences JSONB; -- {min_amount, max_amount, types, excluded_funders}

-- =====================================================
-- PART 8: DASHBOARD METRICS CACHE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.dashboard_metrics_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  metric_type TEXT NOT NULL, -- membership, finance, events, volunteers, grants, impact
  period TEXT NOT NULL, -- current, ytd, last_month, last_quarter, last_year
  data JSONB NOT NULL,
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '1 hour',
  UNIQUE(organization_id, metric_type, period)
);

-- =====================================================
-- PART 9: RLS POLICIES
-- =====================================================

ALTER TABLE public.external_grant_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outcome_indicators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beneficiaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outcome_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_meeting_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_vote_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_action_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grant_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grant_rss_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dashboard_metrics_cache ENABLE ROW LEVEL SECURITY;

-- Org member policies
CREATE POLICY "Org members can view external grants" ON public.external_grant_opportunities
  FOR SELECT USING (is_org_member(organization_id));

CREATE POLICY "Org admins can manage external grants" ON public.external_grant_opportunities
  FOR ALL USING (is_org_admin(organization_id));

CREATE POLICY "Org members can view programs" ON public.programs
  FOR SELECT USING (is_org_member(organization_id));

CREATE POLICY "Org admins can manage programs" ON public.programs
  FOR ALL USING (is_org_admin(organization_id));

CREATE POLICY "Org members can view indicators" ON public.outcome_indicators
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.programs p WHERE p.id = program_id AND is_org_member(p.organization_id)
  ));

CREATE POLICY "Org members can view beneficiaries" ON public.beneficiaries
  FOR SELECT USING (is_org_member(organization_id));

CREATE POLICY "Org admins can manage beneficiaries" ON public.beneficiaries
  FOR ALL USING (is_org_admin(organization_id));

CREATE POLICY "Org members can view outcome data" ON public.outcome_data
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.programs p WHERE p.id = program_id AND is_org_member(p.organization_id)
  ));

CREATE POLICY "Org members can insert outcome data" ON public.outcome_data
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM public.programs p WHERE p.id = program_id AND is_org_member(p.organization_id)
  ));

CREATE POLICY "Org members can view dashboard cache" ON public.dashboard_metrics_cache
  FOR SELECT USING (is_org_member(organization_id));

-- =====================================================
-- PART 10: HELPER FUNCTIONS
-- =====================================================

-- Calculate program impact summary
CREATE OR REPLACE FUNCTION calculate_program_impact(p_program_id UUID)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_beneficiaries', (SELECT COUNT(*) FROM public.beneficiaries WHERE program_id = p_program_id),
    'active_beneficiaries', (SELECT COUNT(*) FROM public.beneficiaries WHERE program_id = p_program_id AND status = 'active'),
    'indicators', (
      SELECT jsonb_agg(jsonb_build_object(
        'name', oi.name,
        'target', oi.target_value,
        'actual', (SELECT SUM(value) FROM public.outcome_data WHERE indicator_id = oi.id),
        'unit', oi.unit
      ))
      FROM public.outcome_indicators oi WHERE oi.program_id = p_program_id
    )
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get organization dashboard metrics
CREATE OR REPLACE FUNCTION get_dashboard_metrics(p_org_id UUID)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'members', jsonb_build_object(
      'total', (SELECT COUNT(*) FROM public.member_organizations WHERE organization_id = p_org_id),
      'active', (SELECT COUNT(*) FROM public.member_organizations WHERE organization_id = p_org_id AND status = 'active'),
      'expiring_soon', (SELECT COUNT(*) FROM public.member_organizations WHERE organization_id = p_org_id AND expires_at BETWEEN NOW() AND NOW() + INTERVAL '30 days')
    ),
    'donations', jsonb_build_object(
      'ytd_total', (SELECT COALESCE(SUM(amount_cents), 0) FROM public.donations WHERE organization_id = p_org_id AND created_at >= date_trunc('year', NOW())),
      'this_month', (SELECT COALESCE(SUM(amount_cents), 0) FROM public.donations WHERE organization_id = p_org_id AND created_at >= date_trunc('month', NOW()))
    ),
    'events', jsonb_build_object(
      'upcoming', (SELECT COUNT(*) FROM public.events WHERE organization_id = p_org_id AND date_start > NOW()),
      'ytd_attendees', (SELECT COALESCE(SUM(registered_count), 0) FROM public.events WHERE organization_id = p_org_id AND date_start >= date_trunc('year', NOW()))
    ),
    'volunteers', jsonb_build_object(
      'total', (SELECT COUNT(DISTINCT user_id) FROM public.volunteer_signups vs 
                JOIN public.volunteer_opportunities vo ON vs.opportunity_id = vo.id 
                WHERE vo.organization_id = p_org_id),
      'hours_ytd', (SELECT COALESCE(SUM(hours), 0) FROM public.volunteer_hours WHERE organization_id = p_org_id AND date >= date_trunc('year', NOW()) AND status = 'approved')
    ),
    'grants', jsonb_build_object(
      'applications_pending', (SELECT COUNT(*) FROM public.grant_applications ga 
                               JOIN public.grant_programs gp ON ga.program_id = gp.id 
                               WHERE gp.organization_id = p_org_id AND ga.status = 'submitted'),
      'opportunities_matched', (SELECT COUNT(*) FROM public.external_grant_opportunities WHERE organization_id = p_org_id AND status IN ('recommended', 'high_priority'))
    )
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- PART 11: SEED DATA
-- =====================================================

-- Default RSS sources for grant discovery
INSERT INTO public.grant_rss_sources (name, url, source_type, is_active) VALUES
  ('Grants.gov - All', 'https://www.grants.gov/rss/GG_NewOppByAgency.xml', 'federal', true),
  ('NIH Funding Opportunities', 'https://grants.nih.gov/grants/guide/rss/funding_opp.xml', 'federal', true)
ON CONFLICT DO NOTHING;
