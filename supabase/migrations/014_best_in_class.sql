-- Migration 014: Best-in-Class Features
-- Health scores, board fundraising accountability, social autopilot, 
-- webhook idempotency, ask/offer networking, data enrichment cache

-- =====================================================
-- PART 1: MEMBER HEALTH SCORE (Predictive Churn)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.member_health_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES public.profiles(id),
  member_org_id UUID REFERENCES public.member_organizations(id),
  
  -- Core Health Score (0-100)
  score INT NOT NULL DEFAULT 50,
  previous_score INT,
  score_change INT GENERATED ALWAYS AS (score - COALESCE(previous_score, score)) STORED,
  
  -- Component Scores
  engagement_score INT DEFAULT 50, -- Events, logins, clicks
  financial_score INT DEFAULT 50,  -- Donation consistency, amount trends
  tenure_score INT DEFAULT 50,     -- Membership length, renewals
  activity_score INT DEFAULT 50,   -- Recent interactions
  
  -- Signals (JSONB for flexibility)
  positive_signals JSONB DEFAULT '[]', -- ["attended_3_events", "increased_donation"]
  negative_signals JSONB DEFAULT '[]', -- ["no_login_30_days", "declined_renewal"]
  
  -- Status
  risk_level TEXT DEFAULT 'healthy', -- healthy, watch, at_risk, critical
  
  -- Tracking
  last_calculated_at TIMESTAMPTZ DEFAULT NOW(),
  last_engagement_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(organization_id, profile_id)
);

CREATE INDEX idx_health_org_risk ON public.member_health_scores(organization_id, risk_level);
CREATE INDEX idx_health_score ON public.member_health_scores(organization_id, score);

-- =====================================================
-- PART 2: BOARD GIVE OR GET TRACKER
-- =====================================================

CREATE TABLE IF NOT EXISTS public.board_fundraising_commitments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  board_member_id UUID REFERENCES public.board_members(id) ON DELETE CASCADE,
  fiscal_year INT NOT NULL,
  
  -- Commitment Amounts
  personal_giving_commitment_cents BIGINT DEFAULT 0,
  solicited_giving_commitment_cents BIGINT DEFAULT 0,
  total_commitment_cents BIGINT GENERATED ALWAYS AS 
    (personal_giving_commitment_cents + solicited_giving_commitment_cents) STORED,
  
  -- Actual Progress
  personal_giving_actual_cents BIGINT DEFAULT 0,
  solicited_giving_actual_cents BIGINT DEFAULT 0,
  total_actual_cents BIGINT GENERATED ALWAYS AS 
    (personal_giving_actual_cents + solicited_giving_actual_cents) STORED,
  
  -- Completion Percentage
  completion_percent NUMERIC(5,2) GENERATED ALWAYS AS (
    CASE 
      WHEN (personal_giving_commitment_cents + solicited_giving_commitment_cents) = 0 THEN 0
      ELSE ROUND(
        ((personal_giving_actual_cents + solicited_giving_actual_cents)::NUMERIC / 
         (personal_giving_commitment_cents + solicited_giving_commitment_cents)) * 100, 2
      )
    END
  ) STORED,
  
  -- Notes
  notes TEXT,
  last_updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(board_member_id, fiscal_year)
);

-- Track individual solicitations
CREATE TABLE IF NOT EXISTS public.board_solicitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commitment_id UUID REFERENCES public.board_fundraising_commitments(id) ON DELETE CASCADE,
  board_member_id UUID REFERENCES public.board_members(id),
  
  -- Solicitation Details
  prospect_name TEXT NOT NULL,
  prospect_email TEXT,
  prospect_company TEXT,
  solicitation_date DATE,
  ask_amount_cents BIGINT,
  
  -- Outcome
  status TEXT DEFAULT 'pending', -- pending, pledged, received, declined
  result_amount_cents BIGINT DEFAULT 0,
  result_date DATE,
  
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- PART 3: SOCIAL AUTOPILOT (Member Spotlight Queue)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.social_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  -- Content Type
  content_type TEXT NOT NULL, -- member_spotlight, event_promo, impact_story, milestone
  
  -- Draft Content
  platform TEXT NOT NULL, -- linkedin, twitter, facebook, instagram
  headline TEXT,
  body TEXT NOT NULL,
  image_url TEXT,
  link_url TEXT,
  hashtags TEXT[],
  
  -- AI Generation
  ai_generated BOOLEAN DEFAULT false,
  ai_prompt TEXT,
  
  -- Source Reference
  source_type TEXT, -- member, event, donation, program
  source_id UUID,
  
  -- Scheduling
  status TEXT DEFAULT 'draft', -- draft, scheduled, approved, posted, rejected
  scheduled_for TIMESTAMPTZ,
  posted_at TIMESTAMPTZ,
  
  -- Approval
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  
  -- Analytics
  post_url TEXT, -- URL after posting
  engagement_data JSONB, -- likes, shares, comments
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_social_queue_status ON public.social_queue(organization_id, status, scheduled_for);

-- =====================================================
-- PART 4: WEBHOOK IDEMPOTENCY TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.processed_webhook_events (
  provider TEXT NOT NULL, -- stripe, paypal, zoom, etc.
  event_id TEXT NOT NULL,
  event_type TEXT,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  result TEXT, -- success, error, skipped
  metadata JSONB,
  PRIMARY KEY (provider, event_id)
);

-- =====================================================
-- PART 5: ASK/OFFER NETWORKING (Smart Matcher)
-- =====================================================

ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS asks TEXT[], -- ["legal advice", "funding intro"]
  ADD COLUMN IF NOT EXISTS offers TEXT[], -- ["mentorship", "marketing help"]
  ADD COLUMN IF NOT EXISTS matching_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS enrichment_data JSONB, -- Data from Clearbit/PeopleDataLabs
  ADD COLUMN IF NOT EXISTS enrichment_updated_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.member_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  -- The two members
  asker_profile_id UUID REFERENCES public.profiles(id),
  offerer_profile_id UUID REFERENCES public.profiles(id),
  
  -- Match Details
  match_type TEXT NOT NULL, -- ask_offer, similar_interests, same_industry
  asker_need TEXT, -- What they asked for
  offerer_capability TEXT, -- What they can offer
  match_score NUMERIC(3,2), -- 0-1 confidence
  
  -- Status
  status TEXT DEFAULT 'suggested', -- suggested, sent, accepted, declined, completed
  
  -- Introduction
  intro_sent_at TIMESTAMPTZ,
  intro_message TEXT,
  
  -- Feedback
  asker_feedback TEXT,
  offerer_feedback TEXT,
  was_helpful BOOLEAN,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(organization_id, asker_profile_id, offerer_profile_id, asker_need)
);

-- =====================================================
-- PART 6: DAILY BRIEFING PREFERENCES
-- =====================================================

CREATE TABLE IF NOT EXISTS public.briefing_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  
  -- Delivery
  enabled BOOLEAN DEFAULT true,
  delivery_time TIME DEFAULT '08:00:00',
  timezone TEXT DEFAULT 'America/Chicago',
  delivery_days INT[] DEFAULT '{1,2,3,4,5}', -- Mon-Fri
  
  -- Content Preferences
  include_revenue BOOLEAN DEFAULT true,
  include_members BOOLEAN DEFAULT true,
  include_approvals BOOLEAN DEFAULT true,
  include_churn_alerts BOOLEAN DEFAULT true,
  include_events BOOLEAN DEFAULT true,
  include_grants BOOLEAN DEFAULT true,
  
  -- Thresholds
  major_gift_threshold_cents BIGINT DEFAULT 100000, -- $1000
  churn_score_threshold INT DEFAULT 50,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(organization_id, user_id)
);

-- =====================================================
-- PART 7: UNIFIED AUTOMATION EVENT TAXONOMY
-- =====================================================

-- Rename to standardize on dot notation
-- This ensures all events follow: entity.action pattern

CREATE TABLE IF NOT EXISTS public.automation_event_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  event_name TEXT NOT NULL, -- donation.created, membership.renewed, etc.
  event_payload JSONB NOT NULL,
  
  -- Processing
  rules_matched INT DEFAULT 0,
  rules_executed INT DEFAULT 0,
  
  -- Source
  source_type TEXT, -- webhook, api, cron, manual
  source_id TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_automation_events ON public.automation_event_log(organization_id, event_name, created_at DESC);

-- =====================================================
-- PART 8: RLS POLICIES
-- =====================================================

ALTER TABLE public.member_health_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_fundraising_commitments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_solicitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.briefing_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_event_log ENABLE ROW LEVEL SECURITY;

-- Health scores - staff can view
CREATE POLICY "Org members can view health scores" ON public.member_health_scores
  FOR SELECT USING (is_org_member(organization_id));

-- Board fundraising - board members see their own, admins see all
CREATE POLICY "Board members see own commitments" ON public.board_fundraising_commitments
  FOR SELECT USING (
    is_org_admin(organization_id) OR 
    board_member_id IN (SELECT id FROM public.board_members WHERE profile_id = auth.uid())
  );

CREATE POLICY "Admins manage commitments" ON public.board_fundraising_commitments
  FOR ALL USING (is_org_admin(organization_id));

-- Social queue - admins only
CREATE POLICY "Admins manage social queue" ON public.social_queue
  FOR ALL USING (is_org_admin(organization_id));

-- Member matches - participants can view
CREATE POLICY "Members see their matches" ON public.member_matches
  FOR SELECT USING (
    is_org_member(organization_id) AND
    (asker_profile_id = auth.uid() OR offerer_profile_id = auth.uid())
  );

-- Briefing preferences - users manage their own
CREATE POLICY "Users manage own briefing prefs" ON public.briefing_preferences
  FOR ALL USING (user_id = auth.uid());

-- =====================================================
-- PART 9: HEALTH SCORE CALCULATION FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION calculate_member_health_score(p_profile_id UUID, p_org_id UUID)
RETURNS INT AS $$
DECLARE
  v_engagement INT := 50;
  v_financial INT := 50;
  v_tenure INT := 50;
  v_activity INT := 50;
  v_final INT;
  v_last_login TIMESTAMPTZ;
  v_last_donation TIMESTAMPTZ;
  v_donation_count INT;
  v_event_count INT;
  v_member_since DATE;
BEGIN
  -- Engagement: events attended in last 6 months
  SELECT COUNT(*) INTO v_event_count
  FROM public.event_registrations er
  JOIN public.events e ON er.event_id = e.id
  WHERE er.profile_id = p_profile_id
    AND e.organization_id = p_org_id
    AND er.status = 'attended'
    AND e.date_start > NOW() - INTERVAL '6 months';
  
  v_engagement := LEAST(100, 30 + (v_event_count * 15));
  
  -- Financial: donation recency and frequency
  SELECT COUNT(*), MAX(created_at) INTO v_donation_count, v_last_donation
  FROM public.donations
  WHERE (donor_profile_id = p_profile_id OR donor_email = (SELECT email FROM public.profiles WHERE id = p_profile_id))
    AND organization_id = p_org_id
    AND created_at > NOW() - INTERVAL '2 years';
  
  v_financial := CASE
    WHEN v_last_donation > NOW() - INTERVAL '3 months' THEN 90
    WHEN v_last_donation > NOW() - INTERVAL '6 months' THEN 70
    WHEN v_last_donation > NOW() - INTERVAL '1 year' THEN 50
    ELSE 30
  END;
  
  -- Tenure: how long they've been a member
  SELECT joined_at INTO v_member_since
  FROM public.member_organizations
  WHERE primary_contact_email = (SELECT email FROM public.profiles WHERE id = p_profile_id)
    AND organization_id = p_org_id;
  
  v_tenure := CASE
    WHEN v_member_since < NOW() - INTERVAL '5 years' THEN 100
    WHEN v_member_since < NOW() - INTERVAL '2 years' THEN 80
    WHEN v_member_since < NOW() - INTERVAL '1 year' THEN 60
    ELSE 40
  END;
  
  -- Activity: recent logins (placeholder - would need auth audit)
  v_activity := 50; -- Default, can be enhanced with Supabase auth hooks
  
  -- Weighted average
  v_final := (v_engagement * 0.3 + v_financial * 0.3 + v_tenure * 0.2 + v_activity * 0.2)::INT;
  
  -- Upsert the score
  INSERT INTO public.member_health_scores (
    organization_id, profile_id, score, previous_score,
    engagement_score, financial_score, tenure_score, activity_score,
    risk_level, last_calculated_at
  ) VALUES (
    p_org_id, p_profile_id, v_final, 
    (SELECT score FROM public.member_health_scores WHERE profile_id = p_profile_id AND organization_id = p_org_id),
    v_engagement, v_financial, v_tenure, v_activity,
    CASE
      WHEN v_final >= 70 THEN 'healthy'
      WHEN v_final >= 50 THEN 'watch'
      WHEN v_final >= 30 THEN 'at_risk'
      ELSE 'critical'
    END,
    NOW()
  )
  ON CONFLICT (organization_id, profile_id) DO UPDATE SET
    previous_score = member_health_scores.score,
    score = v_final,
    engagement_score = v_engagement,
    financial_score = v_financial,
    tenure_score = v_tenure,
    activity_score = v_activity,
    risk_level = CASE
      WHEN v_final >= 70 THEN 'healthy'
      WHEN v_final >= 50 THEN 'watch'
      WHEN v_final >= 30 THEN 'at_risk'
      ELSE 'critical'
    END,
    last_calculated_at = NOW();
  
  RETURN v_final;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- PART 10: BOARD FUNDRAISING PROGRESS VIEW
-- =====================================================

CREATE OR REPLACE VIEW public.board_fundraising_summary AS
SELECT 
  bfc.organization_id,
  bfc.fiscal_year,
  bm.id AS board_member_id,
  p.full_name AS board_member_name,
  p.email AS board_member_email,
  bfc.personal_giving_commitment_cents,
  bfc.personal_giving_actual_cents,
  bfc.solicited_giving_commitment_cents,
  bfc.solicited_giving_actual_cents,
  bfc.total_commitment_cents,
  bfc.total_actual_cents,
  bfc.completion_percent,
  CASE 
    WHEN bfc.completion_percent >= 100 THEN 'complete'
    WHEN bfc.completion_percent >= 75 THEN 'on_track'
    WHEN bfc.completion_percent >= 50 THEN 'behind'
    ELSE 'at_risk'
  END AS progress_status,
  (SELECT COUNT(*) FROM public.board_solicitations bs WHERE bs.commitment_id = bfc.id) AS solicitation_count,
  (SELECT COUNT(*) FROM public.board_solicitations bs WHERE bs.commitment_id = bfc.id AND bs.status = 'received') AS successful_solicitations
FROM public.board_fundraising_commitments bfc
JOIN public.board_members bm ON bfc.board_member_id = bm.id
JOIN public.profiles p ON bm.profile_id = p.id;
