-- ============================================================================
-- MIGRATION 008: Automation Queue Claim Function
-- Atomic job claiming for concurrency-safe workers
-- ============================================================================

-- Function to atomically claim queue items for processing
create or replace function public.claim_automation_queue(p_limit int, p_worker text)
returns setof public.automation_queue
language plpgsql
security definer
as $$
begin
  return query
  with to_claim as (
    select id
    from public.automation_queue
    where status in ('pending', 'retrying')
      and scheduled_for <= now()
      and (locked_at is null or locked_at < now() - interval '10 minutes')
    order by scheduled_for asc, created_at asc
    limit p_limit
    for update skip locked
  )
  update public.automation_queue q
  set status = 'processing',
      locked_at = now(),
      locked_by = p_worker,
      attempts = coalesce(attempts, 0) + 1
  from to_claim
  where q.id = to_claim.id
  returning q.*;
end;
$$;

-- Function to mark queue item as completed
create or replace function public.complete_automation_queue(
  p_id uuid,
  p_result jsonb default null
)
returns void
language plpgsql
security definer
as $$
begin
  update public.automation_queue
  set status = 'completed',
      completed_at = now(),
      result = p_result,
      locked_at = null,
      locked_by = null
  where id = p_id;
end;
$$;

-- Function to mark queue item as failed
create or replace function public.fail_automation_queue(
  p_id uuid,
  p_error text,
  p_max_retries int default 3
)
returns void
language plpgsql
security definer
as $$
declare
  v_attempts int;
begin
  select attempts into v_attempts from public.automation_queue where id = p_id;
  
  if v_attempts >= p_max_retries then
    update public.automation_queue
    set status = 'failed',
        last_error = p_error,
        locked_at = null,
        locked_by = null
    where id = p_id;
  else
    -- Schedule retry with exponential backoff
    update public.automation_queue
    set status = 'retrying',
        last_error = p_error,
        scheduled_for = now() + (power(2, v_attempts) * interval '1 minute'),
        locked_at = null,
        locked_by = null
    where id = p_id;
  end if;
end;
$$;

-- Function to enqueue an automation
create or replace function public.enqueue_automation(
  p_organization_id uuid,
  p_rule_id uuid,
  p_event_type text,
  p_event_payload jsonb,
  p_scheduled_for timestamptz default now()
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_id uuid;
begin
  insert into public.automation_queue (
    organization_id,
    rule_id,
    event_type,
    event_payload,
    scheduled_for,
    status
  ) values (
    p_organization_id,
    p_rule_id,
    p_event_type,
    p_event_payload,
    p_scheduled_for,
    'pending'
  )
  returning id into v_id;
  
  return v_id;
end;
$$;

-- Standardized event types enum (dot notation)
do $$
begin
  if not exists (select 1 from pg_type where typname = 'event_type_v2') then
    create type event_type_v2 as enum (
      -- Donations
      'donation.created',
      'donation.updated',
      'donation.recurring_created',
      'donation.recurring_cancelled',
      -- Membership
      'membership.created',
      'membership.renewed',
      'membership.expired',
      'membership.cancelled',
      'membership.upgraded',
      'membership.downgraded',
      -- Payments
      'payment.created',
      'payment.succeeded',
      'payment.failed',
      'payment.refunded',
      -- Events
      'event.registration_created',
      'event.registration_cancelled',
      'event.checked_in',
      -- Grants
      'grant.application_submitted',
      'grant.application_approved',
      'grant.application_rejected',
      'grant.disbursement_created',
      'grant.report_submitted',
      -- Finance
      'finance.bank_transaction_imported',
      'finance.transaction_categorized',
      'finance.reconciliation_completed',
      -- Members
      'member.created',
      'member.updated',
      'member.engagement_low',
      'member.churn_risk_high'
    );
  end if;
end $$;

-- Event type mapping for backwards compatibility
create table if not exists public.event_type_mapping (
  old_type text primary key,
  new_type text not null
);

insert into public.event_type_mapping (old_type, new_type) values
  ('donation_created', 'donation.created'),
  ('donation_updated', 'donation.updated'),
  ('membership_renewed', 'membership.renewed'),
  ('membership_expired', 'membership.expired'),
  ('payment_failed', 'payment.failed'),
  ('payment_succeeded', 'payment.succeeded'),
  ('event_registration', 'event.registration_created'),
  ('grant_submitted', 'grant.application_submitted')
on conflict (old_type) do nothing;

-- Index for efficient queue processing
create index if not exists idx_automation_queue_pending 
  on public.automation_queue (scheduled_for, created_at) 
  where status in ('pending', 'retrying');

comment on function public.claim_automation_queue is 'Atomically claims queue items for processing with row-level locking';
comment on function public.enqueue_automation is 'Enqueues an automation event for processing';
