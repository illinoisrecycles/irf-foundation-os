-- Migration 013: Enterprise Features
-- Multi-tenant branding, white-label, donor churn, widgets, grant success prediction

-- =====================================================
-- PART 1: MULTI-TENANT BRANDING
-- =====================================================

ALTER TABLE public.organizations 
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS favicon_url TEXT,
  ADD COLUMN IF NOT EXISTS primary_color TEXT DEFAULT '#166534',
  ADD COLUMN IF NOT EXISTS secondary_color TEXT DEFAULT '#3b82f6',
  ADD COLUMN IF NOT EXISTS accent_color TEXT DEFAULT '#f59e0b',
  ADD COLUMN IF NOT EXISTS custom_domain TEXT,
  ADD COLUMN IF NOT EXISTS email_from_name TEXT,
  ADD COLUMN IF NOT EXISTS email_reply_to TEXT,
  ADD COLUMN IF NOT EXISTS footer_text TEXT,
  ADD COLUMN IF NOT EXISTS social_links JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS custom_css TEXT;

-- =====================================================
-- PART 2: WHITE-LABEL PARTNERS
-- =====================================================

CREATE TABLE IF NOT EXISTS public.white_label_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  favicon_url TEXT,
  primary_color TEXT DEFAULT '#166534',
  secondary_color TEXT DEFAULT '#3b82f6',
  domain TEXT UNIQUE,
  support_email TEXT,
  support_url TEXT,
  hide_powered_by BOOLEAN DEFAULT false,
  custom_css TEXT,
  features_enabled JSONB DEFAULT '{}', -- Feature flags per partner
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Link organizations to white-label partners
ALTER TABLE public.organizations 
  ADD COLUMN IF NOT EXISTS white_label_partner_id UUID REFERENCES public.white_label_partners(id);

CREATE INDEX idx_orgs_white_label ON public.organizations(white_label_partner_id);

-- =====================================================
-- PART 3: DONOR CHURN PREDICTION
-- =====================================================

CREATE TABLE IF NOT EXISTS public.donor_churn_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES public.profiles(id),
  member_id UUID REFERENCES public.member_organizations(id),
  
  -- RFM Scores
  recency_days INT, -- Days since last donation
  frequency_score NUMERIC(3,2), -- Donations per year
  monetary_avg_cents BIGINT, -- Average donation amount
  
  -- Engagement Metrics
  event_attendance_count INT DEFAULT 0,
  volunteer_hours NUMERIC DEFAULT 0,
  email_open_rate NUMERIC(3,2),
  last_login_days INT,
  
  -- Behavioral Flags
  declining_amounts BOOLEAN DEFAULT false,
  reduced_frequency BOOLEAN DEFAULT false,
  no_recent_engagement BOOLEAN DEFAULT false,
  downgraded_membership BOOLEAN DEFAULT false,
  
  -- Prediction Results
  risk_score INT, -- 0-100
  risk_level TEXT, -- low, medium, high, critical
  primary_risk_factors TEXT[],
  recommended_actions TEXT[],
  
  -- Tracking
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  actioned_at TIMESTAMPTZ,
  actioned_by UUID REFERENCES auth.users(id),
  outcome TEXT, -- retained, churned, upgraded
  
  UNIQUE(organization_id, profile_id)
);

CREATE INDEX idx_churn_org ON public.donor_churn_predictions(organization_id);
CREATE INDEX idx_churn_risk ON public.donor_churn_predictions(risk_level, risk_score DESC);

-- =====================================================
-- PART 4: GRANT SUCCESS PREDICTION
-- =====================================================

ALTER TABLE public.grant_applications 
  ADD COLUMN IF NOT EXISTS success_probability NUMERIC(3,2), -- 0.00-1.00
  ADD COLUMN IF NOT EXISTS prediction_factors JSONB,
  ADD COLUMN IF NOT EXISTS ai_improvement_suggestions TEXT[],
  ADD COLUMN IF NOT EXISTS actual_outcome TEXT, -- awarded, rejected, partial, withdrawn
  ADD COLUMN IF NOT EXISTS outcome_amount_cents BIGINT,
  ADD COLUMN IF NOT EXISTS outcome_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS outcome_notes TEXT;

-- Historical grant outcomes for ML training
CREATE TABLE IF NOT EXISTS public.grant_outcome_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id),
  funder_name TEXT,
  program_name TEXT,
  amount_requested_cents BIGINT,
  amount_awarded_cents BIGINT,
  outcome TEXT, -- awarded, rejected, partial
  application_year INT,
  key_factors TEXT[], -- What made it successful/fail
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- PART 5: EMBEDDABLE WIDGETS
-- =====================================================

CREATE TABLE IF NOT EXISTS public.embed_widgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  widget_type TEXT NOT NULL, -- impact_counter, donation_form, event_list, volunteer_signup
  name TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}', -- Customization options
  embed_key TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  allowed_domains TEXT[], -- CORS whitelist
  is_active BOOLEAN DEFAULT true,
  view_count INT DEFAULT 0,
  last_viewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_widgets_key ON public.embed_widgets(embed_key);
CREATE INDEX idx_widgets_org ON public.embed_widgets(organization_id);

-- =====================================================
-- PART 6: IMPACT STORIES
-- =====================================================

CREATE TABLE IF NOT EXISTS public.impact_stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  program_id UUID REFERENCES public.programs(id),
  title TEXT NOT NULL,
  story TEXT NOT NULL,
  quote TEXT,
  beneficiary_name TEXT, -- Can be anonymous
  beneficiary_title TEXT,
  photo_url TEXT,
  video_url TEXT,
  tags TEXT[],
  metrics JSONB, -- {people_served: 100, tons_recycled: 50}
  is_featured BOOLEAN DEFAULT false,
  is_public BOOLEAN DEFAULT true,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_stories_org ON public.impact_stories(organization_id);
CREATE INDEX idx_stories_featured ON public.impact_stories(is_featured, published_at DESC);

-- =====================================================
-- PART 7: AI INSIGHTS LOG
-- =====================================================

CREATE TABLE IF NOT EXISTS public.ai_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  insight_type TEXT NOT NULL, -- trend, warning, opportunity, recommendation
  category TEXT, -- membership, donations, grants, events, volunteers
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB, -- Supporting data/metrics
  action_url TEXT,
  action_label TEXT,
  priority INT DEFAULT 5, -- 1-10
  is_dismissed BOOLEAN DEFAULT false,
  dismissed_by UUID REFERENCES auth.users(id),
  dismissed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_insights_org ON public.ai_insights(organization_id, is_dismissed, priority DESC);

-- =====================================================
-- PART 8: GENERATED REPORTS
-- =====================================================

CREATE TABLE IF NOT EXISTS public.generated_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL, -- annual_impact, quarterly_summary, donor_report, grant_report
  title TEXT NOT NULL,
  period_start DATE,
  period_end DATE,
  content TEXT, -- AI-generated narrative
  metrics JSONB,
  pdf_url TEXT,
  generated_by UUID REFERENCES auth.users(id),
  is_published BOOLEAN DEFAULT false,
  published_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- PART 9: RSS FEED SOURCES (Enhanced)
-- =====================================================

ALTER TABLE public.grant_rss_sources 
  ADD COLUMN IF NOT EXISTS parser_config JSONB DEFAULT '{}', -- Field mapping
  ADD COLUMN IF NOT EXISTS last_success_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS success_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS error_count INT DEFAULT 0;

-- Seed default RSS sources
INSERT INTO public.grant_rss_sources (name, url, source_type, is_active, parser_config) VALUES
  ('California Grants Portal', 'https://www.grants.ca.gov/grants-rss/', 'state', true, '{"title_field": "title", "link_field": "link"}'),
  ('Foundation Center News', 'https://philanthropynewsdigest.org/feeds', 'aggregator', true, '{}')
ON CONFLICT DO NOTHING;

-- =====================================================
-- PART 10: RLS POLICIES
-- =====================================================

ALTER TABLE public.white_label_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.donor_churn_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.embed_widgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.impact_stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grant_outcome_history ENABLE ROW LEVEL SECURITY;

-- Public can view published stories
CREATE POLICY "Public can view published stories" ON public.impact_stories
  FOR SELECT USING (is_public = true AND published_at IS NOT NULL);

-- Org members can manage their stories
CREATE POLICY "Org members can manage stories" ON public.impact_stories
  FOR ALL USING (is_org_member(organization_id));

-- Org members can view insights
CREATE POLICY "Org members can view insights" ON public.ai_insights
  FOR SELECT USING (is_org_member(organization_id));

-- Org admins can manage widgets
CREATE POLICY "Org admins can manage widgets" ON public.embed_widgets
  FOR ALL USING (is_org_admin(organization_id));

-- Org members can view churn predictions
CREATE POLICY "Org members can view churn" ON public.donor_churn_predictions
  FOR SELECT USING (is_org_member(organization_id));

-- =====================================================
-- PART 11: HELPER FUNCTIONS
-- =====================================================

-- Calculate donor RFM score
CREATE OR REPLACE FUNCTION calculate_donor_rfm(p_profile_id UUID, p_org_id UUID)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
  last_donation DATE;
  donation_count INT;
  total_donated BIGINT;
  avg_donation BIGINT;
BEGIN
  SELECT 
    MAX(created_at::date),
    COUNT(*),
    COALESCE(SUM(amount_cents), 0),
    COALESCE(AVG(amount_cents), 0)::BIGINT
  INTO last_donation, donation_count, total_donated, avg_donation
  FROM public.donations
  WHERE (donor_profile_id = p_profile_id OR donor_email = (SELECT email FROM public.profiles WHERE id = p_profile_id))
    AND organization_id = p_org_id;
  
  SELECT jsonb_build_object(
    'recency_days', COALESCE(CURRENT_DATE - last_donation, 9999),
    'frequency', donation_count,
    'monetary_total', total_donated,
    'monetary_avg', avg_donation,
    'last_donation', last_donation
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get public impact metrics for widget
CREATE OR REPLACE FUNCTION get_public_impact_metrics(p_org_id UUID)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'people_served', COALESCE((SELECT SUM(value) FROM public.outcome_data od 
                               JOIN public.outcome_indicators oi ON od.indicator_id = oi.id
                               JOIN public.programs p ON oi.program_id = p.id
                               WHERE p.organization_id = p_org_id AND oi.name ILIKE '%served%'), 0),
    'volunteer_hours', COALESCE((SELECT SUM(hours) FROM public.volunteer_hours 
                                 WHERE organization_id = p_org_id AND status = 'approved'), 0),
    'events_held', (SELECT COUNT(*) FROM public.events 
                    WHERE organization_id = p_org_id AND date_start < NOW()),
    'active_members', (SELECT COUNT(*) FROM public.member_organizations 
                       WHERE organization_id = p_org_id AND status = 'active')
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
