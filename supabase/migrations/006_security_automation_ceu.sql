-- ============================================================================
-- FOUNDATION OS - MIGRATION 006: Security, Automation Queue, CEU System
-- ============================================================================
-- Fixes multi-tenant security, adds real-time automation queue,
-- enhances CEU tracking with certificate generation
-- ============================================================================

-- ============================================================================
-- 1. PROFILES - Add active organization for multi-org support
-- ============================================================================
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS active_organization_id UUID REFERENCES organizations(id);

-- ============================================================================
-- 2. AUTOMATION QUEUE (Real-time Event-Driven System)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.automation_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- donation.created, member.score_dropped, etc.
  payload JSONB NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, processing, completed, failed, retrying
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  error_message TEXT,
  scheduled_for TIMESTAMPTZ DEFAULT now(), -- For delayed execution
  locked_at TIMESTAMPTZ, -- Prevents concurrent processing
  locked_by TEXT, -- Worker ID
  created_at TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX idx_automation_queue_pending ON automation_queue(organization_id, status, scheduled_for) 
  WHERE status IN ('pending', 'retrying');
CREATE INDEX idx_automation_queue_locked ON automation_queue(locked_at) WHERE locked_at IS NOT NULL;

-- ============================================================================
-- 3. AUTOMATION RUNS (Execution History)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.automation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_item_id UUID REFERENCES automation_queue(id),
  rule_id UUID REFERENCES automation_rules(id),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  trigger_event TEXT NOT NULL,
  trigger_payload JSONB NOT NULL,
  actions_executed JSONB DEFAULT '[]', -- [{ action: "send_email", success: true, result: {...} }]
  status TEXT DEFAULT 'running', -- running, completed, failed, partial
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  error_message TEXT
);

CREATE INDEX idx_automation_runs_org ON automation_runs(organization_id, started_at DESC);
CREATE INDEX idx_automation_runs_rule ON automation_runs(rule_id, started_at DESC);

-- ============================================================================
-- 4. DOMAIN EVENTS (Immutable Event Log)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.domain_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  aggregate_type TEXT NOT NULL, -- member, donation, event, etc.
  aggregate_id UUID NOT NULL,
  payload JSONB NOT NULL,
  metadata JSONB DEFAULT '{}', -- user_id, ip, etc.
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_domain_events_org ON domain_events(organization_id, created_at DESC);
CREATE INDEX idx_domain_events_aggregate ON domain_events(aggregate_type, aggregate_id);
CREATE INDEX idx_domain_events_type ON domain_events(event_type, created_at DESC);

-- ============================================================================
-- 5. EMAIL OUTBOX (Reliable Email Delivery)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.email_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  to_email TEXT NOT NULL,
  to_name TEXT,
  from_email TEXT,
  subject TEXT NOT NULL,
  html_body TEXT,
  template_id TEXT, -- For React Email templates
  template_data JSONB,
  status TEXT DEFAULT 'pending', -- pending, sent, failed, bounced
  attempts INTEGER DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  resend_id TEXT, -- External email service ID
  idempotency_key TEXT UNIQUE, -- Prevent duplicates
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_email_outbox_pending ON email_outbox(status, created_at) WHERE status = 'pending';

-- ============================================================================
-- 6. CEU ENHANCEMENTS
-- ============================================================================
-- Add certificate tracking to attendee_credits
ALTER TABLE public.attendee_credits
  ADD COLUMN IF NOT EXISTS attended_duration_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS quiz_passed BOOLEAN,
  ADD COLUMN IF NOT EXISTS survey_completed BOOLEAN,
  ADD COLUMN IF NOT EXISTS awarded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS certificate_url TEXT,
  ADD COLUMN IF NOT EXISTS certificate_generated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS certificate_template_id TEXT DEFAULT 'default';

-- Add required minutes to event_credits for auto-awarding
ALTER TABLE public.event_credits
  ADD COLUMN IF NOT EXISTS required_minutes INTEGER DEFAULT 30,
  ADD COLUMN IF NOT EXISTS requires_quiz BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS requires_survey BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_award BOOLEAN DEFAULT true;

-- Event attendance log for duration tracking
CREATE TABLE IF NOT EXISTS public.event_attendance_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_registration_id UUID NOT NULL REFERENCES event_registrations(id) ON DELETE CASCADE,
  zoom_participant_uuid TEXT,
  zoom_user_email TEXT,
  join_time TIMESTAMPTZ NOT NULL,
  leave_time TIMESTAMPTZ,
  duration_minutes INTEGER,
  source TEXT DEFAULT 'zoom', -- zoom, qr_scan, manual
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_attendance_log_registration ON event_attendance_log(event_registration_id);
CREATE INDEX idx_attendance_log_email ON event_attendance_log(zoom_user_email);

-- Certificate templates per organization
CREATE TABLE IF NOT EXISTS public.certificate_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  template_key TEXT NOT NULL, -- default, professional, minimal
  background_url TEXT,
  config JSONB NOT NULL DEFAULT '{}', -- Field positions, fonts, colors
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, template_key)
);

-- Member CEU transcript view
CREATE OR REPLACE VIEW public.member_ceu_transcript AS
SELECT 
  er.member_organization_id,
  mo.name as member_name,
  ec.credit_type,
  ec.accrediting_body,
  SUM(ac.credit_hours) as total_hours,
  COUNT(ac.id) as certificates_earned,
  ARRAY_AGG(DISTINCT e.title) as events_completed
FROM attendee_credits ac
JOIN event_registrations er ON ac.event_registration_id = er.id
JOIN event_credits ec ON ac.event_credit_id = ec.id
JOIN events e ON ec.event_id = e.id
JOIN member_organizations mo ON er.member_organization_id = mo.id
WHERE ac.verified = true
GROUP BY er.member_organization_id, mo.name, ec.credit_type, ec.accrediting_body;

-- ============================================================================
-- 7. DATABASE TRIGGERS FOR AUTOMATION QUEUE
-- ============================================================================

-- Trigger function to capture donation events
CREATE OR REPLACE FUNCTION capture_donation_event()
RETURNS TRIGGER AS $$
BEGIN
  -- Only fire when status becomes succeeded
  IF NEW.status = 'succeeded' AND (OLD IS NULL OR OLD.status != 'succeeded') THEN
    INSERT INTO automation_queue (organization_id, event_type, payload)
    VALUES (
      NEW.organization_id, 
      'donation.created', 
      jsonb_build_object(
        'donation_id', NEW.id, 
        'amount_cents', NEW.amount_cents, 
        'donor_email', NEW.donor_email,
        'donor_name', NEW.donor_name,
        'campaign_id', NEW.campaign_id,
        'is_recurring', NEW.is_recurring
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_donation_created ON donations;
CREATE TRIGGER trg_donation_created
  AFTER INSERT OR UPDATE ON donations
  FOR EACH ROW EXECUTE FUNCTION capture_donation_event();

-- Trigger for member status changes
CREATE OR REPLACE FUNCTION capture_member_event()
RETURNS TRIGGER AS $$
BEGIN
  -- New member
  IF TG_OP = 'INSERT' THEN
    INSERT INTO automation_queue (organization_id, event_type, payload)
    VALUES (
      NEW.organization_id,
      'member.created',
      jsonb_build_object(
        'member_organization_id', NEW.id,
        'name', NEW.name,
        'email', NEW.primary_email,
        'membership_status', NEW.membership_status
      )
    );
  END IF;
  
  -- Status changed to expired
  IF TG_OP = 'UPDATE' AND NEW.membership_status = 'expired' AND OLD.membership_status != 'expired' THEN
    INSERT INTO automation_queue (organization_id, event_type, payload)
    VALUES (
      NEW.organization_id,
      'member.expired',
      jsonb_build_object(
        'member_organization_id', NEW.id,
        'name', NEW.name,
        'email', NEW.primary_email
      )
    );
  END IF;
  
  -- Status changed to active (renewed)
  IF TG_OP = 'UPDATE' AND NEW.membership_status = 'active' AND OLD.membership_status != 'active' THEN
    INSERT INTO automation_queue (organization_id, event_type, payload)
    VALUES (
      NEW.organization_id,
      'member.renewed',
      jsonb_build_object(
        'member_organization_id', NEW.id,
        'name', NEW.name,
        'email', NEW.primary_email
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_member_event ON member_organizations;
CREATE TRIGGER trg_member_event
  AFTER INSERT OR UPDATE ON member_organizations
  FOR EACH ROW EXECUTE FUNCTION capture_member_event();

-- Trigger for event registrations
CREATE OR REPLACE FUNCTION capture_registration_event()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO automation_queue (organization_id, event_type, payload)
  VALUES (
    (SELECT organization_id FROM events WHERE id = NEW.event_id),
    'event.registration.created',
    jsonb_build_object(
      'registration_id', NEW.id,
      'event_id', NEW.event_id,
      'attendee_email', NEW.attendee_email,
      'attendee_name', NEW.attendee_name,
      'member_organization_id', NEW.member_organization_id
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_registration_created ON event_registrations;
CREATE TRIGGER trg_registration_created
  AFTER INSERT ON event_registrations
  FOR EACH ROW EXECUTE FUNCTION capture_registration_event();

-- Trigger for engagement score drops
CREATE OR REPLACE FUNCTION capture_score_change_event()
RETURNS TRIGGER AS $$
BEGIN
  -- Score dropped significantly (by 20+ points)
  IF OLD.score IS NOT NULL AND NEW.score < OLD.score - 20 THEN
    INSERT INTO automation_queue (
      organization_id, 
      event_type, 
      payload
    )
    SELECT 
      mo.organization_id,
      'member.score_dropped',
      jsonb_build_object(
        'member_organization_id', NEW.member_organization_id,
        'old_score', OLD.score,
        'new_score', NEW.score,
        'engagement_tier', NEW.engagement_tier
      )
    FROM member_organizations mo
    WHERE mo.id = NEW.member_organization_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_score_dropped ON member_engagement_scores;
CREATE TRIGGER trg_score_dropped
  AFTER UPDATE ON member_engagement_scores
  FOR EACH ROW EXECUTE FUNCTION capture_score_change_event();

-- ============================================================================
-- 8. AUTO-AWARD CEU FUNCTION
-- ============================================================================
CREATE OR REPLACE FUNCTION auto_award_ceu(p_registration_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_reg RECORD;
  v_credit RECORD;
  v_duration INTEGER;
  v_awarded INTEGER := 0;
BEGIN
  -- Get registration with attendance data
  SELECT 
    er.*,
    COALESCE(SUM(eal.duration_minutes), 0) as total_duration
  INTO v_reg
  FROM event_registrations er
  LEFT JOIN event_attendance_log eal ON eal.event_registration_id = er.id
  WHERE er.id = p_registration_id
  GROUP BY er.id;
  
  IF v_reg IS NULL THEN
    RETURN 0;
  END IF;
  
  -- Check each credit for the event
  FOR v_credit IN 
    SELECT ec.* 
    FROM event_credits ec 
    WHERE ec.event_id = v_reg.event_id 
      AND ec.auto_award = true
  LOOP
    -- Check requirements
    IF v_reg.total_duration >= (v_credit.required_minutes * 0.8) -- 80% attendance
       AND (v_credit.requires_quiz = false OR v_reg.quiz_passed = true)
       AND (v_credit.requires_survey = false OR v_reg.survey_completed = true)
    THEN
      -- Award the credit
      INSERT INTO attendee_credits (
        event_registration_id, 
        event_credit_id, 
        credit_hours,
        verified, 
        verified_at,
        attended_duration_minutes,
        awarded_at
      )
      VALUES (
        p_registration_id, 
        v_credit.id, 
        v_credit.credit_hours,
        true, 
        now(),
        v_reg.total_duration,
        now()
      )
      ON CONFLICT (event_registration_id, event_credit_id) 
      DO UPDATE SET 
        verified = true, 
        verified_at = now(),
        attended_duration_minutes = v_reg.total_duration,
        awarded_at = now();
      
      v_awarded := v_awarded + 1;
    END IF;
  END LOOP;
  
  RETURN v_awarded;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 9. RLS POLICIES FOR NEW TABLES
-- ============================================================================
ALTER TABLE automation_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE domain_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_attendance_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificate_templates ENABLE ROW LEVEL SECURITY;

-- Policies for org admins
CREATE POLICY automation_queue_org_policy ON automation_queue
  FOR ALL USING (organization_id IN (SELECT get_user_org_ids()));

CREATE POLICY automation_runs_org_policy ON automation_runs
  FOR ALL USING (organization_id IN (SELECT get_user_org_ids()));

CREATE POLICY domain_events_org_policy ON domain_events
  FOR ALL USING (organization_id IN (SELECT get_user_org_ids()));

CREATE POLICY email_outbox_org_policy ON email_outbox
  FOR ALL USING (organization_id IN (SELECT get_user_org_ids()));

CREATE POLICY attendance_log_org_policy ON event_attendance_log
  FOR ALL USING (
    event_registration_id IN (
      SELECT er.id FROM event_registrations er
      JOIN events e ON e.id = er.event_id
      WHERE e.organization_id IN (SELECT get_user_org_ids())
    )
  );

CREATE POLICY certificate_templates_org_policy ON certificate_templates
  FOR ALL USING (organization_id IN (SELECT get_user_org_ids()));

-- ============================================================================
-- 10. ADDITIONAL RLS POLICIES FOR WRITE OPERATIONS
-- ============================================================================
-- Members - allow org admins to write
CREATE POLICY members_insert_policy ON member_organizations
  FOR INSERT WITH CHECK (organization_id IN (SELECT get_user_org_ids()));

CREATE POLICY members_update_policy ON member_organizations
  FOR UPDATE USING (organization_id IN (SELECT get_user_org_ids()));

CREATE POLICY members_delete_policy ON member_organizations
  FOR DELETE USING (is_org_admin(organization_id));

-- Events - allow org members to write
CREATE POLICY events_insert_policy ON events
  FOR INSERT WITH CHECK (organization_id IN (SELECT get_user_org_ids()));

CREATE POLICY events_update_policy ON events
  FOR UPDATE USING (organization_id IN (SELECT get_user_org_ids()));

-- Donations - allow org members to write
CREATE POLICY donations_insert_policy ON donations
  FOR INSERT WITH CHECK (organization_id IN (SELECT get_user_org_ids()));

-- Work items - allow org members to write
CREATE POLICY work_items_insert_policy ON work_items
  FOR INSERT WITH CHECK (organization_id IN (SELECT get_user_org_ids()));

CREATE POLICY work_items_update_policy ON work_items
  FOR UPDATE USING (organization_id IN (SELECT get_user_org_ids()));

-- Audit logs - allow authenticated users to insert
CREATE POLICY audit_logs_insert_policy ON audit_logs
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);


-- ============================================================================
-- 11. SPONSORSHIP MANAGEMENT
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.sponsorship_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- Gold, Silver, Bronze, etc.
  amount_cents INTEGER NOT NULL,
  benefits JSONB DEFAULT '[]', -- ["Logo on website", "Booth at event", "5 tickets"]
  max_sponsors INTEGER, -- Limit per tier
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sponsorships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  sponsor_id UUID REFERENCES member_organizations(id), -- If existing member
  sponsor_name TEXT, -- Or external sponsor name
  sponsor_email TEXT,
  sponsor_logo_url TEXT,
  event_id UUID REFERENCES events(id), -- Optional: event-specific sponsorship
  tier_id UUID REFERENCES sponsorship_tiers(id),
  amount_cents INTEGER NOT NULL DEFAULT 0,
  benefits JSONB DEFAULT '[]', -- Custom benefits for this sponsor
  status TEXT DEFAULT 'pending', -- pending, confirmed, paid, cancelled
  payment_status TEXT DEFAULT 'unpaid', -- unpaid, invoiced, paid, refunded
  payment_id UUID REFERENCES payments(id),
  contract_url TEXT,
  notes TEXT,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_sponsorships_org ON sponsorships(organization_id, status);
CREATE INDEX idx_sponsorships_event ON sponsorships(event_id) WHERE event_id IS NOT NULL;

ALTER TABLE sponsorship_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sponsorships ENABLE ROW LEVEL SECURITY;

CREATE POLICY sponsorship_tiers_org_policy ON sponsorship_tiers
  FOR ALL USING (organization_id IN (SELECT get_user_org_ids()));

CREATE POLICY sponsorships_org_policy ON sponsorships
  FOR ALL USING (organization_id IN (SELECT get_user_org_ids()));

-- ============================================================================
-- 12. GRANTS LIFECYCLE COMPLETION
-- ============================================================================
-- Grant disbursement schedule
CREATE TABLE IF NOT EXISTS public.grant_disbursements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  application_id UUID NOT NULL REFERENCES grant_applications(id),
  amount_cents INTEGER NOT NULL,
  scheduled_date DATE NOT NULL,
  status TEXT DEFAULT 'scheduled', -- scheduled, processing, paid, cancelled
  payment_method TEXT, -- check, ach, wire
  check_number TEXT,
  payment_reference TEXT,
  notes TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Board docket items for grant decisions
CREATE TABLE IF NOT EXISTS public.board_docket_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  meeting_date DATE NOT NULL,
  item_type TEXT NOT NULL, -- grant_decision, policy, budget, other
  title TEXT NOT NULL,
  description TEXT,
  reference_type TEXT, -- grant_application, etc
  reference_id UUID,
  recommendation TEXT, -- approve, deny, defer, modify
  discussion_notes TEXT,
  vote_result TEXT, -- approved, denied, tabled
  vote_count JSONB, -- {"yes": 5, "no": 1, "abstain": 1}
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Communication log (unified across email, sms, mail)
CREATE TABLE IF NOT EXISTS public.communication_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- email, sms, mail, call
  direction TEXT DEFAULT 'outbound', -- inbound, outbound
  to_address TEXT, -- email or phone
  from_address TEXT,
  subject TEXT,
  content TEXT,
  status TEXT DEFAULT 'sent',
  external_id TEXT, -- Resend ID, Twilio SID, etc
  member_organization_id UUID REFERENCES member_organizations(id),
  reference_type TEXT,
  reference_id UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- SMS queue for automation
CREATE TABLE IF NOT EXISTS public.sms_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  to_phone TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  scheduled_for TIMESTAMPTZ DEFAULT now(),
  sent_at TIMESTAMPTZ,
  external_id TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Email unsubscribes
CREATE TABLE IF NOT EXISTS public.email_unsubscribes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  campaign_id UUID,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, email)
);

-- Email tracking
CREATE TABLE IF NOT EXISTS public.email_opens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL,
  email TEXT NOT NULL,
  opened_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.email_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL,
  email TEXT NOT NULL,
  url TEXT NOT NULL,
  clicked_at TIMESTAMPTZ DEFAULT now()
);

-- Add opt-in to members
ALTER TABLE public.member_organizations
  ADD COLUMN IF NOT EXISTS email_opt_in BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS sms_opt_in BOOLEAN DEFAULT false;

-- Function to increment campaign stats
CREATE OR REPLACE FUNCTION increment_campaign_stat(campaign_id UUID, stat_name TEXT)
RETURNS void AS $$
BEGIN
  UPDATE email_campaigns
  SET stats = jsonb_set(
    COALESCE(stats, '{}'::jsonb),
    ARRAY[stat_name],
    to_jsonb(COALESCE((stats->>stat_name)::int, 0) + 1)
  )
  WHERE id = campaign_id;
END;
$$ LANGUAGE plpgsql;

-- RLS for new tables
ALTER TABLE grant_disbursements ENABLE ROW LEVEL SECURITY;
ALTER TABLE board_docket_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE communication_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_unsubscribes ENABLE ROW LEVEL SECURITY;

CREATE POLICY grant_disbursements_org ON grant_disbursements
  FOR ALL USING (organization_id IN (SELECT get_user_org_ids()));
CREATE POLICY board_docket_items_org ON board_docket_items
  FOR ALL USING (organization_id IN (SELECT get_user_org_ids()));
CREATE POLICY communication_log_org ON communication_log
  FOR ALL USING (organization_id IN (SELECT get_user_org_ids()));
CREATE POLICY sms_queue_org ON sms_queue
  FOR ALL USING (organization_id IN (SELECT get_user_org_ids()));
CREATE POLICY email_unsubscribes_org ON email_unsubscribes
  FOR ALL USING (organization_id IN (SELECT get_user_org_ids()));
