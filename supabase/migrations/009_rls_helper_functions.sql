-- ============================================================================
-- MIGRATION 009: RLS Helper Functions
-- Standardized functions for consistent RLS policy checks
-- ============================================================================

-- Function to check if user has any membership in an organization
create or replace function public.is_org_member(p_org_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 
    from public.organization_members 
    where organization_id = p_org_id 
      and profile_id = auth.uid()
  );
$$;

-- Function to check if user has a specific role in an organization
create or replace function public.has_org_role(p_org_id uuid, p_roles text[])
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 
    from public.organization_members 
    where organization_id = p_org_id 
      and profile_id = auth.uid()
      and role = any(p_roles)
  );
$$;

-- Function to check if user is admin of an organization
create or replace function public.is_org_admin(p_org_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select public.has_org_role(p_org_id, array['admin', 'owner']);
$$;

-- Function to check if user has finance role
create or replace function public.has_finance_access(p_org_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select public.has_org_role(p_org_id, array['admin', 'owner', 'finance']);
$$;

-- Function to get user's active organization from profile
create or replace function public.get_active_org_id()
returns uuid
language sql
security definer
stable
as $$
  select active_organization_id 
  from public.profiles 
  where id = auth.uid();
$$;

-- Function to get all organization IDs user belongs to
create or replace function public.get_user_org_ids()
returns setof uuid
language sql
security definer
stable
as $$
  select organization_id 
  from public.organization_members 
  where profile_id = auth.uid();
$$;

-- ============================================================================
-- UPDATE RLS POLICIES TO USE HELPER FUNCTIONS
-- ============================================================================

-- Members table
drop policy if exists "Users can view members in their orgs" on public.members;
create policy "Users can view members in their orgs" on public.members
  for select using (public.is_org_member(organization_id));

drop policy if exists "Admins can manage members" on public.members;
create policy "Admins can manage members" on public.members
  for all using (public.is_org_admin(organization_id));

-- Payments table
drop policy if exists "Users can view payments in their orgs" on public.payments;
create policy "Users can view payments in their orgs" on public.payments
  for select using (public.is_org_member(organization_id));

drop policy if exists "Finance users can manage payments" on public.payments;
create policy "Finance users can manage payments" on public.payments
  for all using (public.has_finance_access(organization_id));

-- Work items table
drop policy if exists "Users can view work items in their orgs" on public.work_items;
create policy "Users can view work items in their orgs" on public.work_items
  for select using (public.is_org_member(organization_id));

drop policy if exists "Users can manage work items in their orgs" on public.work_items;
create policy "Users can manage work items in their orgs" on public.work_items
  for all using (public.is_org_member(organization_id));

-- Events table
drop policy if exists "Users can view events in their orgs" on public.events;
create policy "Users can view events in their orgs" on public.events
  for select using (public.is_org_member(organization_id) or status = 'published');

drop policy if exists "Admins can manage events" on public.events;
create policy "Admins can manage events" on public.events
  for all using (public.is_org_admin(organization_id));

-- Donations table
drop policy if exists "Users can view donations in their orgs" on public.donations;
create policy "Users can view donations in their orgs" on public.donations
  for select using (public.is_org_member(organization_id));

drop policy if exists "Finance users can manage donations" on public.donations;
create policy "Finance users can manage donations" on public.donations
  for all using (public.has_finance_access(organization_id));

-- GL Accounts table
drop policy if exists "Users can view GL accounts in their orgs" on public.gl_accounts;
create policy "Users can view GL accounts in their orgs" on public.gl_accounts
  for select using (public.is_org_member(organization_id));

drop policy if exists "Finance users can manage GL accounts" on public.gl_accounts;
create policy "Finance users can manage GL accounts" on public.gl_accounts
  for all using (public.has_finance_access(organization_id));

-- Journal entries table
drop policy if exists "Users can view journal entries in their orgs" on public.journal_entries;
create policy "Users can view journal entries in their orgs" on public.journal_entries
  for select using (public.is_org_member(organization_id));

drop policy if exists "Finance users can manage journal entries" on public.journal_entries;
create policy "Finance users can manage journal entries" on public.journal_entries
  for all using (public.has_finance_access(organization_id));

-- Bank transactions table
drop policy if exists "Users can view bank transactions in their orgs" on public.bank_transactions;
create policy "Users can view bank transactions in their orgs" on public.bank_transactions
  for select using (public.is_org_member(organization_id));

drop policy if exists "Finance users can manage bank transactions" on public.bank_transactions;
create policy "Finance users can manage bank transactions" on public.bank_transactions
  for all using (public.has_finance_access(organization_id));

-- Automation rules table
drop policy if exists "Users can view automation rules in their orgs" on public.automation_rules;
create policy "Users can view automation rules in their orgs" on public.automation_rules
  for select using (public.is_org_member(organization_id));

drop policy if exists "Admins can manage automation rules" on public.automation_rules;
create policy "Admins can manage automation rules" on public.automation_rules
  for all using (public.is_org_admin(organization_id));

-- Grant applications table
drop policy if exists "Users can view grant applications in their orgs" on public.grant_applications;
create policy "Users can view grant applications in their orgs" on public.grant_applications
  for select using (public.is_org_member(organization_id));

drop policy if exists "Admins can manage grant applications" on public.grant_applications;
create policy "Admins can manage grant applications" on public.grant_applications
  for all using (public.is_org_admin(organization_id));

-- Saved views table
drop policy if exists "Users can view their own saved views" on public.saved_views;
create policy "Users can view their own saved views" on public.saved_views
  for select using (
    profile_id = auth.uid() 
    or (is_shared = true and public.is_org_member(organization_id))
  );

drop policy if exists "Users can manage their own saved views" on public.saved_views;
create policy "Users can manage their own saved views" on public.saved_views
  for all using (profile_id = auth.uid());

-- Email lists table
drop policy if exists "Users can view email lists in their orgs" on public.email_lists;
create policy "Users can view email lists in their orgs" on public.email_lists
  for select using (public.is_org_member(organization_id));

drop policy if exists "Admins can manage email lists" on public.email_lists;
create policy "Admins can manage email lists" on public.email_lists
  for all using (public.is_org_admin(organization_id));

-- Webhooks table
drop policy if exists "Admins can view webhooks in their orgs" on public.webhooks;
create policy "Admins can view webhooks in their orgs" on public.webhooks
  for select using (public.is_org_admin(organization_id));

drop policy if exists "Admins can manage webhooks" on public.webhooks;
create policy "Admins can manage webhooks" on public.webhooks
  for all using (public.is_org_admin(organization_id));

comment on function public.is_org_member is 'Check if current user is a member of the organization';
comment on function public.has_org_role is 'Check if current user has one of the specified roles in the organization';
comment on function public.is_org_admin is 'Check if current user is an admin or owner of the organization';
comment on function public.has_finance_access is 'Check if current user has finance access (admin, owner, or finance role)';

-- ============================================================================
-- BANK RULES TABLE
-- Deterministic rules for categorizing bank transactions
-- ============================================================================

create table if not exists public.bank_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  priority int not null default 0,
  is_active boolean not null default true,
  
  -- Matching conditions (all must match)
  conditions jsonb not null default '{}',
  -- Examples:
  -- { "merchant_name": { "contains": "AMAZON" } }
  -- { "amount_cents": { "gte": 10000, "lte": 50000 } }
  -- { "memo": { "regex": "^INV-\\d+" } }
  
  -- Actions to apply
  account_id uuid references public.gl_accounts(id),
  class_id uuid references public.classes(id),
  project_id uuid references public.projects(id),
  vendor_id uuid references public.vendors(id),
  tags text[] default '{}',
  memo_template text,
  
  -- Metadata
  match_count int not null default 0,
  last_matched_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by_profile_id uuid references public.profiles(id)
);

create index if not exists idx_bank_rules_org_priority on public.bank_rules(organization_id, priority desc, is_active);

-- RLS
alter table public.bank_rules enable row level security;

drop policy if exists "Users can view bank rules in their orgs" on public.bank_rules;
create policy "Users can view bank rules in their orgs" on public.bank_rules
  for select using (public.is_org_member(organization_id));

drop policy if exists "Finance users can manage bank rules" on public.bank_rules;
create policy "Finance users can manage bank rules" on public.bank_rules
  for all using (public.has_finance_access(organization_id));

-- ============================================================================
-- VENDOR TABLE (for bank rule matching)
-- ============================================================================

create table if not exists public.vendors (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  display_name text,
  default_account_id uuid references public.gl_accounts(id),
  default_class_id uuid references public.classes(id),
  tax_id text,
  email text,
  phone text,
  address jsonb,
  is_1099_eligible boolean default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_vendors_org on public.vendors(organization_id);
create index if not exists idx_vendors_name on public.vendors(organization_id, name);

alter table public.vendors enable row level security;

drop policy if exists "Users can view vendors in their orgs" on public.vendors;
create policy "Users can view vendors in their orgs" on public.vendors
  for select using (public.is_org_member(organization_id));

drop policy if exists "Finance users can manage vendors" on public.vendors;
create policy "Finance users can manage vendors" on public.vendors
  for all using (public.has_finance_access(organization_id));

comment on table public.bank_rules is 'Deterministic rules for auto-categorizing bank transactions';
comment on table public.vendors is 'Vendors/payees for expense tracking and 1099 reporting';
