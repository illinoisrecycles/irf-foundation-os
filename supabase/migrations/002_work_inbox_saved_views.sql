-- ============================================================================
-- MIGRATION: 002_work_inbox_saved_views.sql
-- Description: Add Work Inbox and Saved Views functionality
-- ============================================================================

-- ============================================================================
-- WORK ITEMS TABLE (Work Inbox)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.work_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

  -- Item type and classification
  type TEXT NOT NULL CHECK (type IN ('task', 'alert', 'approval')),
  module TEXT NOT NULL CHECK (module IN ('memberships', 'donations', 'events', 'grants', 'finance', 'cms', 'general')),

  -- Content
  title TEXT NOT NULL,
  body TEXT,

  -- Priority and status
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'snoozed', 'done')),

  -- Scheduling
  due_at TIMESTAMPTZ,
  snoozed_until TIMESTAMPTZ,

  -- Assignment
  assignee_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  assignee_role TEXT,

  -- Reference to related entity
  reference_type TEXT,
  reference_id UUID,

  -- Deduplication key (prevents duplicate work items from cron)
  dedupe_key TEXT,
  
  -- Actions (JSON with buttons/links)
  actions JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Audit
  created_by_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique constraint for deduplication
CREATE UNIQUE INDEX IF NOT EXISTS work_items_org_dedupe_unique
  ON public.work_items (organization_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL;

-- Performance indexes
CREATE INDEX IF NOT EXISTS work_items_org_status_due_idx
  ON public.work_items (organization_id, status, due_at);

CREATE INDEX IF NOT EXISTS work_items_org_assignee_idx
  ON public.work_items (organization_id, assignee_profile_id);

CREATE INDEX IF NOT EXISTS work_items_org_module_idx
  ON public.work_items (organization_id, module);

CREATE INDEX IF NOT EXISTS work_items_org_reference_idx
  ON public.work_items (organization_id, reference_type, reference_id);

-- ============================================================================
-- SAVED VIEWS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.saved_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

  -- View configuration
  module TEXT NOT NULL CHECK (module IN ('members', 'donations', 'events', 'payments', 'grants')),
  name TEXT NOT NULL,

  -- Sharing options
  is_shared BOOLEAN NOT NULL DEFAULT false,
  is_default BOOLEAN NOT NULL DEFAULT false,

  -- Owner
  created_by_profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  -- View state (filters, sorting, columns, etc.)
  state JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS saved_views_org_module_idx
  ON public.saved_views (organization_id, module);

CREATE INDEX IF NOT EXISTS saved_views_org_shared_idx
  ON public.saved_views (organization_id, module, is_shared);

CREATE INDEX IF NOT EXISTS saved_views_creator_idx
  ON public.saved_views (created_by_profile_id);

-- ============================================================================
-- UPDATE TRIGGERS
-- ============================================================================

-- Auto-update updated_at for work_items
CREATE OR REPLACE FUNCTION update_work_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS work_items_updated_at ON public.work_items;
CREATE TRIGGER work_items_updated_at
  BEFORE UPDATE ON public.work_items
  FOR EACH ROW
  EXECUTE FUNCTION update_work_items_updated_at();

-- Auto-update updated_at for saved_views
CREATE OR REPLACE FUNCTION update_saved_views_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS saved_views_updated_at ON public.saved_views;
CREATE TRIGGER saved_views_updated_at
  BEFORE UPDATE ON public.saved_views
  FOR EACH ROW
  EXECUTE FUNCTION update_saved_views_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY (Enable when auth is implemented)
-- ============================================================================

-- Enable RLS
ALTER TABLE public.work_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_views ENABLE ROW LEVEL SECURITY;

-- Work Items: Users can view/edit items in their org
CREATE POLICY "Users can view work items in their org"
  ON public.work_items FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members 
      WHERE profile_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert work items in their org"
  ON public.work_items FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members 
      WHERE profile_id = auth.uid()
    )
  );

CREATE POLICY "Users can update work items in their org"
  ON public.work_items FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members 
      WHERE profile_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete work items in their org"
  ON public.work_items FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members 
      WHERE profile_id = auth.uid()
    )
  );

-- Saved Views: Users can view shared views or their own
CREATE POLICY "Users can view saved views"
  ON public.saved_views FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members 
      WHERE profile_id = auth.uid()
    )
    AND (is_shared = true OR created_by_profile_id = auth.uid())
  );

CREATE POLICY "Users can insert their own saved views"
  ON public.saved_views FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members 
      WHERE profile_id = auth.uid()
    )
    AND created_by_profile_id = auth.uid()
  );

CREATE POLICY "Users can update their own saved views"
  ON public.saved_views FOR UPDATE
  USING (created_by_profile_id = auth.uid());

CREATE POLICY "Users can delete their own saved views"
  ON public.saved_views FOR DELETE
  USING (created_by_profile_id = auth.uid());

-- ============================================================================
-- SAMPLE DATA (for testing)
-- ============================================================================

-- Insert sample work items (uncomment and modify org_id after creating org)
/*
INSERT INTO public.work_items (organization_id, type, module, title, body, priority, due_at, actions) VALUES
  ('YOUR_ORG_ID', 'alert', 'memberships', 'Renewal due: John Smith', 'Membership expires on 2025-01-15', 'normal', '2025-01-08', '{"primary": {"label": "Send reminder", "href": "/admin/members?action=send-renewal"}}'),
  ('YOUR_ORG_ID', 'task', 'donations', 'Send receipt: Jane Doe', 'Donation of $250 received yesterday', 'normal', now(), '{"primary": {"label": "Send receipt", "href": "/admin/donations?action=send-receipt"}}'),
  ('YOUR_ORG_ID', 'task', 'events', 'Send reminders: Circularity Conference', 'Event starts in 7 days. 156 registered attendees.', 'high', now(), '{"primary": {"label": "Send reminders", "href": "/admin/events?action=send-reminders"}}');
*/
