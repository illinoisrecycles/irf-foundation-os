-- =====================================================
-- MIGRATION 004: Enhanced Platform Features
-- Member engagement, advanced events, workflows, analytics
-- =====================================================

-- =====================================================
-- 1. MEMBER ENGAGEMENT SCORING
-- =====================================================

-- Track all member activities for engagement scoring
CREATE TABLE IF NOT EXISTS public.member_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_organization_id UUID NOT NULL REFERENCES public.member_organizations(id) ON DELETE CASCADE,
  member_contact_id UUID REFERENCES public.member_contacts(id),
  
  activity_type TEXT NOT NULL, -- event_registered, event_attended, resource_downloaded, forum_post, email_opened, email_clicked, login, profile_updated, payment_made, job_posted
  activity_date TIMESTAMPTZ DEFAULT NOW(),
  
  -- Points for engagement score
  points INT DEFAULT 1,
  
  -- Reference to what triggered it
  reference_type TEXT, -- event, resource, email_campaign, forum_topic, etc.
  reference_id UUID,
  
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Engagement scores (calculated/cached)
CREATE TABLE IF NOT EXISTS public.member_engagement_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_organization_id UUID NOT NULL REFERENCES public.member_organizations(id) ON DELETE CASCADE,
  
  -- Rolling scores
  score_30_days INT DEFAULT 0,
  score_90_days INT DEFAULT 0,
  score_365_days INT DEFAULT 0,
  score_lifetime INT DEFAULT 0,
  
  -- Activity counts
  events_attended_ytd INT DEFAULT 0,
  resources_downloaded_ytd INT DEFAULT 0,
  forum_posts_ytd INT DEFAULT 0,
  emails_opened_ytd INT DEFAULT 0,
  logins_ytd INT DEFAULT 0,
  
  -- Engagement tier: champion, engaged, passive, at_risk, dormant
  engagement_tier TEXT DEFAULT 'passive',
  
  -- Renewal prediction (0-100)
  renewal_likelihood INT DEFAULT 50,
  
  last_activity_at TIMESTAMPTZ,
  last_calculated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(member_organization_id)
);

-- Membership milestones and achievements
CREATE TABLE IF NOT EXISTS public.member_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_organization_id UUID NOT NULL REFERENCES public.member_organizations(id) ON DELETE CASCADE,
  
  milestone_type TEXT NOT NULL, -- years_member, events_attended, first_event, first_post, profile_complete, etc.
  milestone_value INT, -- e.g., 5 for "5 years member"
  achieved_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Badge display
  badge_name TEXT,
  badge_icon TEXT,
  
  notified_at TIMESTAMPTZ,
  
  UNIQUE(member_organization_id, milestone_type, milestone_value)
);

-- =====================================================
-- 2. ENHANCED EVENT MANAGEMENT
-- =====================================================

-- Event tracks (for multi-track conferences)
CREATE TABLE IF NOT EXISTS public.event_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT, -- For UI display
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Speakers
CREATE TABLE IF NOT EXISTS public.event_speakers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  -- Basic info
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  
  -- Professional info
  title TEXT,
  company TEXT,
  bio TEXT,
  photo_url TEXT,
  
  -- Social links
  linkedin_url TEXT,
  twitter_url TEXT,
  website_url TEXT,
  
  -- For speaker portal
  profile_id UUID REFERENCES public.profiles(id),
  
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Link speakers to sessions
CREATE TABLE IF NOT EXISTS public.event_session_speakers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.event_sessions(id) ON DELETE CASCADE,
  speaker_id UUID NOT NULL REFERENCES public.event_speakers(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'speaker', -- speaker, moderator, panelist
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id, speaker_id)
);

-- Sponsorship levels
CREATE TABLE IF NOT EXISTS public.sponsorship_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  event_id UUID REFERENCES public.events(id), -- NULL for org-wide levels
  
  name TEXT NOT NULL, -- Platinum, Gold, Silver, Bronze
  price_cents INT NOT NULL,
  
  -- Benefits (JSON for flexibility)
  benefits JSONB DEFAULT '[]', -- [{name: "Logo on website", included: true}, ...]
  
  -- Limits
  max_sponsors INT,
  current_sponsors INT DEFAULT 0,
  
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- CEU/Credit tracking
CREATE TABLE IF NOT EXISTS public.event_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES public.events(id),
  session_id UUID REFERENCES public.event_sessions(id),
  
  credit_type TEXT NOT NULL, -- CEU, PDH, CLE, etc.
  credit_hours DECIMAL(4,2) NOT NULL,
  accrediting_body TEXT,
  accreditation_number TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Attendee credit records
CREATE TABLE IF NOT EXISTS public.attendee_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_registration_id UUID NOT NULL REFERENCES public.event_registrations(id) ON DELETE CASCADE,
  event_credit_id UUID NOT NULL REFERENCES public.event_credits(id),
  
  -- Verification
  verified BOOLEAN DEFAULT false,
  verified_at TIMESTAMPTZ,
  verified_by UUID REFERENCES public.profiles(id),
  
  -- Certificate
  certificate_url TEXT,
  certificate_generated_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_registration_id, event_credit_id)
);

-- Event feedback/surveys
CREATE TABLE IF NOT EXISTS public.event_surveys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.event_sessions(id),
  
  survey_type TEXT DEFAULT 'post_event', -- post_event, post_session, speaker_eval
  title TEXT NOT NULL,
  questions JSONB NOT NULL, -- [{id, type, question, options, required}, ...]
  
  is_active BOOLEAN DEFAULT true,
  send_automatically BOOLEAN DEFAULT true,
  send_delay_hours INT DEFAULT 24,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.event_survey_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id UUID NOT NULL REFERENCES public.event_surveys(id) ON DELETE CASCADE,
  event_registration_id UUID NOT NULL REFERENCES public.event_registrations(id),
  
  responses JSONB NOT NULL, -- {question_id: answer, ...}
  
  -- Overall ratings (extracted for easy querying)
  overall_rating INT, -- 1-5
  would_recommend BOOLEAN,
  
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(survey_id, event_registration_id)
);

-- =====================================================
-- 3. WORKFLOW AUTOMATION ENGINE
-- =====================================================

-- Workflow definitions
CREATE TABLE IF NOT EXISTS public.workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  name TEXT NOT NULL,
  description TEXT,
  
  -- Trigger configuration
  trigger_type TEXT NOT NULL, -- member_joined, member_expiring, event_registered, donation_received, form_submitted, manual, scheduled
  trigger_config JSONB DEFAULT '{}', -- {days_before_expiry: 30, event_id: '...', etc.}
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Stats
  times_triggered INT DEFAULT 0,
  last_triggered_at TIMESTAMPTZ,
  
  created_by_profile_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Workflow steps (the actions to take)
CREATE TABLE IF NOT EXISTS public.workflow_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  
  step_order INT NOT NULL,
  
  -- Timing
  delay_type TEXT DEFAULT 'immediate', -- immediate, delay, specific_time
  delay_value INT, -- minutes/hours/days depending on delay_unit
  delay_unit TEXT, -- minutes, hours, days
  
  -- Action
  action_type TEXT NOT NULL, -- send_email, create_task, update_field, add_tag, send_notification, webhook
  action_config JSONB NOT NULL, -- {template_id: '...', to: 'contact', subject: '...'}
  
  -- Conditions (optional)
  conditions JSONB, -- [{field: 'membership_status', operator: 'equals', value: 'active'}]
  
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Workflow execution log
CREATE TABLE IF NOT EXISTS public.workflow_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  
  -- What triggered it
  trigger_entity_type TEXT, -- member_organization, event_registration, donation, etc.
  trigger_entity_id UUID,
  
  -- Status
  status TEXT DEFAULT 'running', -- running, completed, failed, cancelled
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  
  -- Progress
  current_step INT DEFAULT 0,
  steps_completed INT DEFAULT 0,
  steps_total INT DEFAULT 0
);

-- =====================================================
-- 4. ENHANCED DIRECTORY WITH SERVICES
-- =====================================================

-- Services/capabilities that members can offer
CREATE TABLE IF NOT EXISTS public.directory_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  
  parent_id UUID REFERENCES public.directory_services(id),
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, slug)
);

-- Link members to services they provide
CREATE TABLE IF NOT EXISTS public.member_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_organization_id UUID NOT NULL REFERENCES public.member_organizations(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES public.directory_services(id) ON DELETE CASCADE,
  
  -- Optional details
  description TEXT,
  certifications TEXT[],
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(member_organization_id, service_id)
);

-- Service area coverage (geographic)
CREATE TABLE IF NOT EXISTS public.member_service_areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_organization_id UUID NOT NULL REFERENCES public.member_organizations(id) ON DELETE CASCADE,
  
  area_type TEXT NOT NULL, -- state, county, city, zip, radius
  area_value TEXT NOT NULL, -- 'IL', 'Cook County', '62701', '50 miles'
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RFQ (Request for Quote) system
CREATE TABLE IF NOT EXISTS public.rfqs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  -- Requester info
  requester_name TEXT NOT NULL,
  requester_email TEXT NOT NULL,
  requester_phone TEXT,
  requester_company TEXT,
  
  -- Request details
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  services_needed UUID[], -- Array of service IDs
  location TEXT,
  timeline TEXT,
  budget_range TEXT,
  
  -- Status
  status TEXT DEFAULT 'open', -- open, in_progress, closed
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

-- RFQ sent to specific members
CREATE TABLE IF NOT EXISTS public.rfq_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id UUID NOT NULL REFERENCES public.rfqs(id) ON DELETE CASCADE,
  member_organization_id UUID NOT NULL REFERENCES public.member_organizations(id) ON DELETE CASCADE,
  
  -- Response
  status TEXT DEFAULT 'pending', -- pending, viewed, responded, declined
  viewed_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  response_message TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(rfq_id, member_organization_id)
);

-- =====================================================
-- 5. MEMBER SELF-SERVICE PORTAL
-- =====================================================

-- Invoices
CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  member_organization_id UUID REFERENCES public.member_organizations(id),
  profile_id UUID REFERENCES public.profiles(id),
  
  -- Invoice details
  invoice_number TEXT NOT NULL,
  invoice_date DATE NOT NULL,
  due_date DATE NOT NULL,
  
  -- Amounts
  subtotal_cents INT NOT NULL,
  tax_cents INT DEFAULT 0,
  total_cents INT NOT NULL,
  amount_paid_cents INT DEFAULT 0,
  
  -- Status
  status TEXT DEFAULT 'draft', -- draft, sent, viewed, paid, overdue, cancelled
  
  -- Line items stored as JSON for flexibility
  line_items JSONB NOT NULL, -- [{description, quantity, unit_price_cents, total_cents}]
  
  -- Payment
  stripe_invoice_id TEXT,
  payment_url TEXT,
  paid_at TIMESTAMPTZ,
  
  -- Communication
  sent_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  reminder_sent_at TIMESTAMPTZ,
  
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(organization_id, invoice_number)
);

-- Member portal activity/audit log
CREATE TABLE IF NOT EXISTS public.member_portal_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_organization_id UUID NOT NULL REFERENCES public.member_organizations(id) ON DELETE CASCADE,
  member_contact_id UUID REFERENCES public.member_contacts(id),
  
  action TEXT NOT NULL, -- login, profile_update, contact_added, invoice_viewed, etc.
  details JSONB,
  ip_address TEXT,
  user_agent TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 6. FORMS BUILDER
-- =====================================================

CREATE TABLE IF NOT EXISTS public.forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  
  -- Form configuration
  fields JSONB NOT NULL, -- [{id, type, label, required, options, validation}, ...]
  
  -- Settings
  submit_button_text TEXT DEFAULT 'Submit',
  success_message TEXT DEFAULT 'Thank you for your submission.',
  redirect_url TEXT,
  
  -- Notifications
  notify_emails TEXT[], -- Email addresses to notify on submission
  
  -- Access
  is_public BOOLEAN DEFAULT true,
  requires_login BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  
  -- Limits
  max_submissions INT,
  submissions_count INT DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(organization_id, slug)
);

CREATE TABLE IF NOT EXISTS public.form_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id UUID NOT NULL REFERENCES public.forms(id) ON DELETE CASCADE,
  
  -- Submitter (if known)
  profile_id UUID REFERENCES public.profiles(id),
  member_contact_id UUID REFERENCES public.member_contacts(id),
  
  -- Data
  data JSONB NOT NULL, -- {field_id: value, ...}
  
  -- Metadata
  ip_address TEXT,
  user_agent TEXT,
  referrer TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 7. NOTIFICATIONS SYSTEM
-- =====================================================

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  -- Recipient
  profile_id UUID REFERENCES public.profiles(id),
  member_contact_id UUID REFERENCES public.member_contacts(id),
  
  -- Content
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  notification_type TEXT DEFAULT 'info', -- info, success, warning, action_required
  
  -- Link
  action_url TEXT,
  action_label TEXT,
  
  -- Status
  read_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,
  
  -- Delivery
  email_sent BOOLEAN DEFAULT false,
  push_sent BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_member_activities_org ON public.member_activities(member_organization_id);
CREATE INDEX IF NOT EXISTS idx_member_activities_date ON public.member_activities(activity_date);
CREATE INDEX IF NOT EXISTS idx_member_activities_type ON public.member_activities(activity_type);
CREATE INDEX IF NOT EXISTS idx_engagement_scores_tier ON public.member_engagement_scores(engagement_tier);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_status ON public.workflow_runs(status);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_member ON public.invoices(member_organization_id);
CREATE INDEX IF NOT EXISTS idx_notifications_profile ON public.notifications(profile_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON public.notifications(profile_id) WHERE read_at IS NULL;

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE public.member_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_engagement_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_submissions ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- FUNCTIONS FOR ENGAGEMENT SCORING
-- =====================================================

-- Function to calculate engagement score for a member
CREATE OR REPLACE FUNCTION calculate_engagement_score(member_org_id UUID)
RETURNS void AS $$
DECLARE
  score_30 INT;
  score_90 INT;
  score_365 INT;
  score_all INT;
  tier TEXT;
  last_activity TIMESTAMPTZ;
BEGIN
  -- Calculate scores for different periods
  SELECT COALESCE(SUM(points), 0) INTO score_30
  FROM member_activities
  WHERE member_organization_id = member_org_id
    AND activity_date > NOW() - INTERVAL '30 days';
    
  SELECT COALESCE(SUM(points), 0) INTO score_90
  FROM member_activities
  WHERE member_organization_id = member_org_id
    AND activity_date > NOW() - INTERVAL '90 days';
    
  SELECT COALESCE(SUM(points), 0) INTO score_365
  FROM member_activities
  WHERE member_organization_id = member_org_id
    AND activity_date > NOW() - INTERVAL '365 days';
    
  SELECT COALESCE(SUM(points), 0) INTO score_all
  FROM member_activities
  WHERE member_organization_id = member_org_id;
  
  -- Get last activity
  SELECT MAX(activity_date) INTO last_activity
  FROM member_activities
  WHERE member_organization_id = member_org_id;
  
  -- Determine tier based on 90-day score
  tier := CASE
    WHEN score_90 >= 100 THEN 'champion'
    WHEN score_90 >= 50 THEN 'engaged'
    WHEN score_90 >= 20 THEN 'passive'
    WHEN score_90 >= 5 THEN 'at_risk'
    ELSE 'dormant'
  END;
  
  -- Upsert the score
  INSERT INTO member_engagement_scores (
    member_organization_id, score_30_days, score_90_days, score_365_days,
    score_lifetime, engagement_tier, last_activity_at, last_calculated_at
  ) VALUES (
    member_org_id, score_30, score_90, score_365, score_all, tier, last_activity, NOW()
  )
  ON CONFLICT (member_organization_id) DO UPDATE SET
    score_30_days = EXCLUDED.score_30_days,
    score_90_days = EXCLUDED.score_90_days,
    score_365_days = EXCLUDED.score_365_days,
    score_lifetime = EXCLUDED.score_lifetime,
    engagement_tier = EXCLUDED.engagement_tier,
    last_activity_at = EXCLUDED.last_activity_at,
    last_calculated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-recalculate on new activity
CREATE OR REPLACE FUNCTION trigger_recalculate_engagement()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM calculate_engagement_score(NEW.member_organization_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_recalculate_engagement ON public.member_activities;
CREATE TRIGGER trg_recalculate_engagement
  AFTER INSERT ON public.member_activities
  FOR EACH ROW
  EXECUTE FUNCTION trigger_recalculate_engagement();

