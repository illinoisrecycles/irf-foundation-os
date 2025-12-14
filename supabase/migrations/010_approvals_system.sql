-- ============================================================================
-- MIGRATION 010: APPROVALS & GOVERNANCE SYSTEM
-- Multi-step approval workflows with segregation of duties
-- ============================================================================

-- Approval Requests (the core governance object)
CREATE TABLE IF NOT EXISTS public.approval_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES public.profiles(id),
  
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'canceled', 'expired')),
  approval_type TEXT NOT NULL, -- 'grant_award', 'grant_disbursement', 'vendor_payment', 'period_close', 'expense', 'budget'
  
  entity_table TEXT NOT NULL,
  entity_id UUID NOT NULL,
  amount_cents BIGINT,
  currency TEXT DEFAULT 'usd',
  
  title TEXT NOT NULL,
  description TEXT,
  urgency TEXT DEFAULT 'normal' CHECK (urgency IN ('low', 'normal', 'high', 'critical')),
  due_date TIMESTAMPTZ,
  
  policy_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES public.profiles(id)
);

-- Approval Steps (multi-step workflow)
CREATE TABLE IF NOT EXISTS public.approval_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  approval_request_id UUID NOT NULL REFERENCES public.approval_requests(id) ON DELETE CASCADE,
  
  step_order INT NOT NULL,
  step_name TEXT,
  role_required TEXT,      -- e.g. 'finance_approver', 'board_member', 'executive_director'
  profile_id UUID REFERENCES public.profiles(id), -- optional specific approver
  
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'skipped')),
  decided_at TIMESTAMPTZ,
  decided_by UUID REFERENCES public.profiles(id),
  decision_note TEXT,
  
  reminder_sent_at TIMESTAMPTZ,
  escalated_at TIMESTAMPTZ
);

-- Approval Policies (configurable rules)
CREATE TABLE IF NOT EXISTS public.approval_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  name TEXT NOT NULL,
  description TEXT,
  approval_type TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  
  -- Conditions (when does this policy apply?)
  min_amount_cents BIGINT,
  max_amount_cents BIGINT,
  conditions JSONB DEFAULT '{}'::jsonb,
  
  -- Steps configuration
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Example: [{"step_order": 1, "role_required": "manager"}, {"step_order": 2, "role_required": "finance_director"}]
  
  -- Settings
  auto_approve_below_cents BIGINT,
  require_segregation BOOLEAN DEFAULT true, -- preparer cannot be approver
  allow_self_approval BOOLEAN DEFAULT false,
  expiry_days INT DEFAULT 30,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Approval Delegates (vacation coverage, etc.)
CREATE TABLE IF NOT EXISTS public.approval_delegates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  delegator_id UUID NOT NULL REFERENCES public.profiles(id),
  delegate_id UUID NOT NULL REFERENCES public.profiles(id),
  
  approval_types TEXT[], -- null means all types
  start_date DATE NOT NULL,
  end_date DATE,
  
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enhanced Member Risk Tracking
ALTER TABLE public.member_organizations 
ADD COLUMN IF NOT EXISTS risk_flag TEXT CHECK (risk_flag IN ('low', 'medium', 'high', 'critical')),
ADD COLUMN IF NOT EXISTS risk_flagged_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS lifetime_value_cents BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS donor_tier TEXT CHECK (donor_tier IN ('bronze', 'silver', 'gold', 'platinum')),
ADD COLUMN IF NOT EXISTS chapter_id UUID;

-- Chapters for Smart Router
CREATE TABLE IF NOT EXISTS public.chapters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  name TEXT NOT NULL,
  code TEXT,
  region TEXT,
  states TEXT[], -- array of state codes
  zip_prefixes TEXT[], -- array of zip prefixes
  
  president_id UUID REFERENCES public.profiles(id),
  contact_email TEXT,
  
  is_active BOOLEAN DEFAULT true,
  member_count INT DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Scheduled Automations (time-based triggers)
CREATE TABLE IF NOT EXISTS public.scheduled_automations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  name TEXT NOT NULL,
  description TEXT,
  
  -- Schedule configuration
  schedule_type TEXT NOT NULL CHECK (schedule_type IN ('cron', 'interval', 'once')),
  cron_expression TEXT, -- e.g. "0 0 * * 1" for every Monday
  interval_minutes INT,
  run_at TIMESTAMPTZ, -- for 'once' type
  timezone TEXT DEFAULT 'America/Chicago',
  
  -- What to run
  automation_rule_id UUID REFERENCES public.automation_rules(id),
  action_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- State
  is_active BOOLEAN DEFAULT true,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  run_count INT DEFAULT 0,
  last_error TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- State Watchers (condition-based triggers)
CREATE TABLE IF NOT EXISTS public.state_watchers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  name TEXT NOT NULL,
  description TEXT,
  
  -- What to watch
  watched_table TEXT NOT NULL,
  condition_sql TEXT, -- e.g. "status = 'submitted' AND created_at < NOW() - INTERVAL '14 days'"
  condition_jsonb JSONB, -- alternative structured conditions
  
  -- What to do when condition matches
  automation_rule_id UUID REFERENCES public.automation_rules(id),
  action_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Throttling
  check_interval_minutes INT DEFAULT 60,
  cooldown_minutes INT DEFAULT 1440, -- don't re-trigger same entity for 24h
  
  is_active BOOLEAN DEFAULT true,
  last_check_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- State Watcher Triggers (track what's been triggered)
CREATE TABLE IF NOT EXISTS public.state_watcher_triggers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state_watcher_id UUID NOT NULL REFERENCES public.state_watchers(id) ON DELETE CASCADE,
  entity_id UUID NOT NULL,
  triggered_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(state_watcher_id, entity_id)
);

-- Document Templates
CREATE TABLE IF NOT EXISTS public.document_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  name TEXT NOT NULL,
  description TEXT,
  template_type TEXT NOT NULL, -- 'tax_receipt', 'award_letter', 'decline_letter', 'acknowledgment', 'resolution', 'agreement'
  
  -- Template content
  content_html TEXT,
  content_markdown TEXT,
  merge_fields JSONB DEFAULT '[]'::jsonb, -- available merge fields
  
  -- PDF settings
  paper_size TEXT DEFAULT 'letter',
  orientation TEXT DEFAULT 'portrait',
  header_html TEXT,
  footer_html TEXT,
  
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Generated Documents
CREATE TABLE IF NOT EXISTS public.generated_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  template_id UUID REFERENCES public.document_templates(id),
  document_type TEXT NOT NULL,
  
  entity_table TEXT,
  entity_id UUID,
  
  title TEXT NOT NULL,
  file_url TEXT,
  file_size_bytes INT,
  
  merge_data JSONB DEFAULT '{}'::jsonb,
  
  sent_to_email TEXT,
  sent_at TIMESTAMPTZ,
  
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Board Meetings
CREATE TABLE IF NOT EXISTS public.board_meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  title TEXT NOT NULL,
  meeting_date TIMESTAMPTZ NOT NULL,
  location TEXT,
  is_virtual BOOLEAN DEFAULT false,
  virtual_link TEXT,
  
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'canceled')),
  
  -- Agenda and minutes
  agenda_html TEXT,
  minutes_html TEXT,
  minutes_approved_at TIMESTAMPTZ,
  minutes_approved_by UUID REFERENCES public.profiles(id),
  
  -- Attendance
  quorum_required INT,
  attendees JSONB DEFAULT '[]'::jsonb,
  
  -- Packet
  packet_generated_at TIMESTAMPTZ,
  packet_url TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Board Agenda Items
CREATE TABLE IF NOT EXISTS public.board_agenda_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  meeting_id UUID NOT NULL REFERENCES public.board_meetings(id) ON DELETE CASCADE,
  
  item_order INT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  item_type TEXT DEFAULT 'discussion' CHECK (item_type IN ('consent', 'discussion', 'action', 'information', 'executive_session')),
  
  -- For action items
  requires_vote BOOLEAN DEFAULT false,
  approval_request_id UUID REFERENCES public.approval_requests(id),
  
  -- Vote results
  vote_result TEXT CHECK (vote_result IN ('approved', 'rejected', 'tabled', 'withdrawn')),
  votes_for INT,
  votes_against INT,
  votes_abstain INT,
  
  -- Supporting documents
  attachments JSONB DEFAULT '[]'::jsonb,
  
  presenter_id UUID REFERENCES public.profiles(id),
  time_allocated_minutes INT,
  
  notes TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_approval_requests_org_status ON public.approval_requests(organization_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_approval_requests_type ON public.approval_requests(organization_id, approval_type);
CREATE INDEX IF NOT EXISTS idx_approval_steps_request ON public.approval_steps(approval_request_id, step_order);
CREATE INDEX IF NOT EXISTS idx_approval_steps_pending ON public.approval_steps(organization_id, status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_scheduled_automations_next ON public.scheduled_automations(next_run_at) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_state_watchers_active ON public.state_watchers(organization_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_chapters_org ON public.chapters(organization_id);
CREATE INDEX IF NOT EXISTS idx_board_meetings_org ON public.board_meetings(organization_id, meeting_date DESC);

-- RLS Policies
ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.state_watchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_agenda_items ENABLE ROW LEVEL SECURITY;

-- Basic RLS (org members can access their org's data)
CREATE POLICY "Org members can view approval_requests" ON public.approval_requests
  FOR SELECT USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE profile_id = auth.uid()));

CREATE POLICY "Org members can view approval_steps" ON public.approval_steps
  FOR SELECT USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE profile_id = auth.uid()));

CREATE POLICY "Org members can view chapters" ON public.chapters
  FOR SELECT USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE profile_id = auth.uid()));

CREATE POLICY "Org members can view board_meetings" ON public.board_meetings
  FOR SELECT USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE profile_id = auth.uid()));
