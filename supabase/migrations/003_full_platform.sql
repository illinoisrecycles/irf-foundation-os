-- =====================================================
-- MIGRATION 003: Full Association Management Platform
-- MemberClicks-equivalent features for FoundationOS
-- =====================================================

-- =====================================================
-- 1. ORGANIZATIONAL MEMBERSHIPS
-- =====================================================

-- Member organizations (the actual members - businesses, nonprofits, etc.)
CREATE TABLE IF NOT EXISTS public.member_organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  -- Organization details
  name TEXT NOT NULL,
  legal_name TEXT,
  org_type TEXT DEFAULT 'business', -- business, nonprofit, government, municipality, educational, individual
  industry TEXT, -- recycling_hauler, mrf, manufacturer, consultant, government, etc.
  
  -- Size/classification
  employee_count_range TEXT, -- 1-10, 11-50, 51-200, 201-500, 500+
  annual_revenue_range TEXT,
  service_area TEXT, -- local, regional, statewide, national
  
  -- Contact info
  website TEXT,
  phone TEXT,
  email TEXT,
  
  -- Address
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  country TEXT DEFAULT 'US',
  
  -- Social media
  linkedin_url TEXT,
  facebook_url TEXT,
  twitter_url TEXT,
  instagram_url TEXT,
  
  -- Directory settings
  is_directory_visible BOOLEAN DEFAULT true,
  directory_description TEXT,
  logo_url TEXT,
  
  -- Membership
  membership_plan_id UUID REFERENCES public.membership_plans(id),
  membership_status TEXT DEFAULT 'pending', -- pending, active, expired, cancelled, suspended
  member_since DATE,
  membership_expires_at TIMESTAMPTZ,
  
  -- Billing
  stripe_customer_id TEXT,
  
  -- Internal
  notes TEXT,
  tags TEXT[],
  custom_fields JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contacts for member organizations (multiple people per org)
CREATE TABLE IF NOT EXISTS public.member_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_organization_id UUID NOT NULL REFERENCES public.member_organizations(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES public.profiles(id), -- Link to auth user if they have login
  
  -- Contact details
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  mobile_phone TEXT,
  
  -- Role at organization
  job_title TEXT,
  department TEXT,
  is_primary_contact BOOLEAN DEFAULT false,
  is_billing_contact BOOLEAN DEFAULT false,
  
  -- Permissions
  can_manage_membership BOOLEAN DEFAULT false,
  can_register_events BOOLEAN DEFAULT true,
  can_view_directory BOOLEAN DEFAULT true,
  
  -- Communication preferences
  email_opt_in BOOLEAN DEFAULT true,
  newsletter_opt_in BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 2. MEMBER DIRECTORY
-- =====================================================

-- Directory categories
CREATE TABLE IF NOT EXISTS public.directory_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  parent_id UUID REFERENCES public.directory_categories(id),
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Link members to directory categories (many-to-many)
CREATE TABLE IF NOT EXISTS public.member_directory_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_organization_id UUID NOT NULL REFERENCES public.member_organizations(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.directory_categories(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(member_organization_id, category_id)
);

-- =====================================================
-- 3. EMAIL MARKETING / COMMUNICATIONS
-- =====================================================

-- Email lists/segments
CREATE TABLE IF NOT EXISTS public.email_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT DEFAULT 'manual', -- manual, dynamic, all_members, all_contacts
  filter_criteria JSONB, -- For dynamic lists
  subscriber_count INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Email list subscribers
CREATE TABLE IF NOT EXISTS public.email_list_subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_list_id UUID NOT NULL REFERENCES public.email_lists(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  member_contact_id UUID REFERENCES public.member_contacts(id),
  member_organization_id UUID REFERENCES public.member_organizations(id),
  status TEXT DEFAULT 'subscribed', -- subscribed, unsubscribed, bounced, complained
  subscribed_at TIMESTAMPTZ DEFAULT NOW(),
  unsubscribed_at TIMESTAMPTZ,
  UNIQUE(email_list_id, email)
);

-- Email templates
CREATE TABLE IF NOT EXISTS public.email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  html_content TEXT,
  text_content TEXT,
  template_type TEXT DEFAULT 'campaign', -- campaign, transactional, automated
  category TEXT, -- newsletter, announcement, reminder, welcome, etc.
  variables JSONB DEFAULT '[]', -- Available merge variables
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Email campaigns
CREATE TABLE IF NOT EXISTS public.email_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  from_name TEXT,
  from_email TEXT,
  reply_to TEXT,
  
  -- Content
  html_content TEXT,
  text_content TEXT,
  template_id UUID REFERENCES public.email_templates(id),
  
  -- Recipients
  email_list_id UUID REFERENCES public.email_lists(id),
  recipient_filter JSONB, -- Additional filtering
  
  -- Scheduling
  status TEXT DEFAULT 'draft', -- draft, scheduled, sending, sent, cancelled
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  
  -- Stats
  total_recipients INT DEFAULT 0,
  sent_count INT DEFAULT 0,
  delivered_count INT DEFAULT 0,
  opened_count INT DEFAULT 0,
  clicked_count INT DEFAULT 0,
  bounced_count INT DEFAULT 0,
  unsubscribed_count INT DEFAULT 0,
  
  created_by_profile_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Email sends (individual email tracking)
CREATE TABLE IF NOT EXISTS public.email_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES public.email_campaigns(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  member_contact_id UUID REFERENCES public.member_contacts(id),
  
  status TEXT DEFAULT 'pending', -- pending, sent, delivered, opened, clicked, bounced, complained
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  bounced_at TIMESTAMPTZ,
  bounce_reason TEXT,
  
  -- Tracking
  open_count INT DEFAULT 0,
  click_count INT DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Automated email sequences (drip campaigns)
CREATE TABLE IF NOT EXISTS public.email_automations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT NOT NULL, -- new_member, membership_expiring, event_registered, donation_received, manual
  trigger_config JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Steps in automation sequence
CREATE TABLE IF NOT EXISTS public.email_automation_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id UUID NOT NULL REFERENCES public.email_automations(id) ON DELETE CASCADE,
  step_order INT NOT NULL,
  delay_days INT DEFAULT 0,
  delay_hours INT DEFAULT 0,
  template_id UUID REFERENCES public.email_templates(id),
  subject TEXT,
  html_content TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 4. CMS / WEBSITE CONTENT
-- =====================================================

-- Web pages
CREATE TABLE IF NOT EXISTS public.cms_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  content TEXT, -- HTML or Markdown
  excerpt TEXT,
  featured_image_url TEXT,
  
  -- SEO
  meta_title TEXT,
  meta_description TEXT,
  meta_keywords TEXT,
  
  -- Publishing
  status TEXT DEFAULT 'draft', -- draft, published, archived
  published_at TIMESTAMPTZ,
  
  -- Navigation
  parent_id UUID REFERENCES public.cms_pages(id),
  menu_order INT DEFAULT 0,
  show_in_menu BOOLEAN DEFAULT false,
  
  -- Access
  is_members_only BOOLEAN DEFAULT false,
  
  created_by_profile_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(organization_id, slug)
);

-- Blog posts
CREATE TABLE IF NOT EXISTS public.cms_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  content TEXT,
  excerpt TEXT,
  featured_image_url TEXT,
  
  -- Categorization
  category TEXT,
  tags TEXT[],
  
  -- SEO
  meta_title TEXT,
  meta_description TEXT,
  
  -- Publishing
  status TEXT DEFAULT 'draft',
  published_at TIMESTAMPTZ,
  
  -- Author
  author_profile_id UUID REFERENCES public.profiles(id),
  author_name TEXT,
  
  -- Engagement
  view_count INT DEFAULT 0,
  
  -- Access
  is_members_only BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(organization_id, slug)
);

-- =====================================================
-- 5. JOB BOARD
-- =====================================================

CREATE TABLE IF NOT EXISTS public.job_postings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  posted_by_member_id UUID REFERENCES public.member_organizations(id),
  
  -- Job details
  title TEXT NOT NULL,
  company_name TEXT NOT NULL,
  company_logo_url TEXT,
  description TEXT NOT NULL,
  requirements TEXT,
  responsibilities TEXT,
  
  -- Classification
  job_type TEXT DEFAULT 'full_time', -- full_time, part_time, contract, internship, temporary
  experience_level TEXT, -- entry, mid, senior, executive
  category TEXT,
  
  -- Location
  location TEXT,
  city TEXT,
  state TEXT,
  is_remote BOOLEAN DEFAULT false,
  remote_type TEXT, -- fully_remote, hybrid, on_site
  
  -- Compensation
  salary_min INT,
  salary_max INT,
  salary_type TEXT DEFAULT 'annual', -- annual, hourly, contract
  show_salary BOOLEAN DEFAULT true,
  benefits TEXT,
  
  -- Application
  application_url TEXT,
  application_email TEXT,
  application_instructions TEXT,
  
  -- Publishing
  status TEXT DEFAULT 'draft', -- draft, pending_review, published, expired, closed
  published_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  
  -- Stats
  view_count INT DEFAULT 0,
  application_count INT DEFAULT 0,
  
  -- Pricing (if job board is paid)
  is_featured BOOLEAN DEFAULT false,
  is_member_posting BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Job applications tracking
CREATE TABLE IF NOT EXISTS public.job_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_posting_id UUID NOT NULL REFERENCES public.job_postings(id) ON DELETE CASCADE,
  
  applicant_name TEXT NOT NULL,
  applicant_email TEXT NOT NULL,
  applicant_phone TEXT,
  resume_url TEXT,
  cover_letter TEXT,
  
  status TEXT DEFAULT 'submitted', -- submitted, reviewed, interviewing, hired, rejected
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 6. COMMUNITY / FORUMS
-- =====================================================

-- Discussion forums
CREATE TABLE IF NOT EXISTS public.forums (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  display_order INT DEFAULT 0,
  
  -- Access
  is_members_only BOOLEAN DEFAULT true,
  required_membership_level TEXT,
  
  -- Stats
  topic_count INT DEFAULT 0,
  post_count INT DEFAULT 0,
  
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(organization_id, slug)
);

-- Forum topics/threads
CREATE TABLE IF NOT EXISTS public.forum_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  forum_id UUID NOT NULL REFERENCES public.forums(id) ON DELETE CASCADE,
  author_profile_id UUID REFERENCES public.profiles(id),
  author_contact_id UUID REFERENCES public.member_contacts(id),
  
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  
  -- Status
  is_pinned BOOLEAN DEFAULT false,
  is_locked BOOLEAN DEFAULT false,
  is_answered BOOLEAN DEFAULT false,
  
  -- Stats
  view_count INT DEFAULT 0,
  reply_count INT DEFAULT 0,
  last_reply_at TIMESTAMPTZ,
  last_reply_by UUID REFERENCES public.profiles(id),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Forum replies
CREATE TABLE IF NOT EXISTS public.forum_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID NOT NULL REFERENCES public.forum_topics(id) ON DELETE CASCADE,
  author_profile_id UUID REFERENCES public.profiles(id),
  author_contact_id UUID REFERENCES public.member_contacts(id),
  parent_reply_id UUID REFERENCES public.forum_replies(id),
  
  content TEXT NOT NULL,
  
  is_answer BOOLEAN DEFAULT false, -- Marked as the answer
  is_edited BOOLEAN DEFAULT false,
  edited_at TIMESTAMPTZ,
  
  -- Reactions
  like_count INT DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 7. RESOURCES / DOCUMENT LIBRARY
-- =====================================================

CREATE TABLE IF NOT EXISTS public.resource_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  parent_id UUID REFERENCES public.resource_folders(id),
  display_order INT DEFAULT 0,
  is_members_only BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, slug)
);

CREATE TABLE IF NOT EXISTS public.resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES public.resource_folders(id),
  
  title TEXT NOT NULL,
  description TEXT,
  
  -- File or link
  resource_type TEXT DEFAULT 'file', -- file, link, video, document
  file_url TEXT,
  file_name TEXT,
  file_size INT,
  file_type TEXT, -- pdf, doc, xls, etc.
  external_url TEXT,
  
  -- Categorization
  category TEXT,
  tags TEXT[],
  
  -- Access
  is_members_only BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  
  -- Stats
  download_count INT DEFAULT 0,
  view_count INT DEFAULT 0,
  
  uploaded_by_profile_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 8. SOCIAL MEDIA INTEGRATION
-- =====================================================

CREATE TABLE IF NOT EXISTS public.social_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  platform TEXT NOT NULL, -- facebook, twitter, linkedin, instagram
  account_name TEXT,
  account_id TEXT,
  access_token TEXT, -- Encrypted
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  connected_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.social_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  content TEXT NOT NULL,
  media_urls TEXT[],
  link_url TEXT,
  
  -- Publishing
  status TEXT DEFAULT 'draft', -- draft, scheduled, published, failed
  scheduled_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  
  -- Targets
  post_to_facebook BOOLEAN DEFAULT false,
  post_to_twitter BOOLEAN DEFAULT false,
  post_to_linkedin BOOLEAN DEFAULT false,
  post_to_instagram BOOLEAN DEFAULT false,
  
  -- Results
  facebook_post_id TEXT,
  twitter_post_id TEXT,
  linkedin_post_id TEXT,
  instagram_post_id TEXT,
  
  error_message TEXT,
  
  created_by_profile_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 9. REPORTS / ANALYTICS
-- =====================================================

CREATE TABLE IF NOT EXISTS public.saved_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  report_type TEXT NOT NULL, -- membership, financial, events, email, custom
  config JSONB NOT NULL, -- Report configuration (filters, columns, etc.)
  is_scheduled BOOLEAN DEFAULT false,
  schedule_frequency TEXT, -- daily, weekly, monthly
  schedule_recipients TEXT[],
  last_run_at TIMESTAMPTZ,
  created_by_profile_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activity log for audit trail
CREATE TABLE IF NOT EXISTS public.activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  actor_profile_id UUID REFERENCES public.profiles(id),
  actor_contact_id UUID REFERENCES public.member_contacts(id),
  
  action TEXT NOT NULL, -- created, updated, deleted, viewed, logged_in, etc.
  entity_type TEXT NOT NULL, -- member, event, donation, email, etc.
  entity_id UUID,
  entity_name TEXT,
  
  details JSONB,
  ip_address TEXT,
  user_agent TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 10. ENHANCED EVENTS
-- =====================================================

-- Event sessions (for multi-session conferences)
CREATE TABLE IF NOT EXISTS public.event_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  session_type TEXT DEFAULT 'session', -- keynote, session, workshop, networking, break, meal
  
  -- Timing
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  
  -- Location
  room TEXT,
  track TEXT,
  
  -- Capacity
  max_attendees INT,
  registered_count INT DEFAULT 0,
  
  -- Speakers
  speaker_names TEXT[],
  
  -- Materials
  slides_url TEXT,
  recording_url TEXT,
  
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Session registrations (which sessions attendees signed up for)
CREATE TABLE IF NOT EXISTS public.event_session_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_registration_id UUID NOT NULL REFERENCES public.event_registrations(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES public.event_sessions(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'registered', -- registered, attended, cancelled
  checked_in_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_registration_id, session_id)
);

-- Event sponsors
CREATE TABLE IF NOT EXISTS public.event_sponsors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  member_organization_id UUID REFERENCES public.member_organizations(id),
  
  name TEXT NOT NULL,
  logo_url TEXT,
  website_url TEXT,
  description TEXT,
  
  sponsorship_level TEXT, -- platinum, gold, silver, bronze, etc.
  amount_cents INT,
  
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_member_organizations_org ON public.member_organizations(organization_id);
CREATE INDEX IF NOT EXISTS idx_member_organizations_status ON public.member_organizations(membership_status);
CREATE INDEX IF NOT EXISTS idx_member_contacts_org ON public.member_contacts(member_organization_id);
CREATE INDEX IF NOT EXISTS idx_member_contacts_email ON public.member_contacts(email);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_org ON public.email_campaigns(organization_id);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_status ON public.email_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_job_postings_status ON public.job_postings(status);
CREATE INDEX IF NOT EXISTS idx_forum_topics_forum ON public.forum_topics(forum_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_org ON public.activity_log(organization_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_created ON public.activity_log(created_at);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE public.member_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.directory_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_postings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forums ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies (organization-scoped access)
CREATE POLICY "Org members can view their member_organizations" ON public.member_organizations
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members 
      WHERE profile_id = auth.uid()
    )
  );

CREATE POLICY "Org admins can manage member_organizations" ON public.member_organizations
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members 
      WHERE profile_id = auth.uid() AND role IN ('owner', 'admin', 'staff')
    )
  );

-- Public directory visibility
CREATE POLICY "Public can view directory-visible members" ON public.member_organizations
  FOR SELECT USING (is_directory_visible = true AND membership_status = 'active');

