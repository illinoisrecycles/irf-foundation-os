-- =====================================================
-- MIGRATION 007: AI BOOKKEEPING ENGINE (CLEAN)
-- Run this fresh - drops and recreates everything
-- =====================================================

-- =====================
-- Drop existing policies if they exist (cleanup from failed runs)
-- =====================

DO $$ 
DECLARE
  pol record;
BEGIN
  FOR pol IN 
    SELECT policyname, tablename 
    FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename IN (
      'ledger_accounts', 'org_bookkeeping_settings', 'vendors',
      'journal_entries', 'journal_lines', 'bank_connections',
      'bank_accounts', 'bank_transactions', 'bank_transaction_matches',
      'categorization_rules', 'ai_suggestions', 'receipt_scans',
      'budgets', 'budget_lines', 'cash_flow_forecasts',
      'financial_insights', 'reconciliations', 'financial_periods'
    )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

-- =====================
-- Helper functions
-- =====================

DROP FUNCTION IF EXISTS public.is_org_member(uuid);
DROP FUNCTION IF EXISTS public.has_org_role(uuid, text[]);

CREATE FUNCTION public.is_org_member(p_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM organization_members
    WHERE organization_id = p_org_id
      AND profile_id = auth.uid()
  );
$$;

CREATE FUNCTION public.has_org_role(p_org_id uuid, p_roles text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM organization_members
    WHERE organization_id = p_org_id
      AND profile_id = auth.uid()
      AND role::text = ANY(p_roles)
  );
$$;

-- =====================
-- Types (skip if exist)
-- =====================

DO $$ BEGIN
  CREATE TYPE public.account_type AS ENUM ('asset','liability','equity','revenue','expense');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.journal_entry_status AS ENUM ('draft','posted','void');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.bank_tx_status AS ENUM ('new','matched','categorized','ignored','needs_review');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.functional_expense AS ENUM ('program','management_general','fundraising');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =====================
-- Tables
-- =====================

CREATE TABLE IF NOT EXISTS public.ledger_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  type public.account_type NOT NULL,
  subtype TEXT,
  parent_id UUID REFERENCES public.ledger_accounts(id) ON DELETE SET NULL,
  fund_type TEXT DEFAULT 'unrestricted',
  tax_line TEXT,
  current_balance_cents BIGINT DEFAULT 0,
  normal_balance TEXT DEFAULT 'debit',
  is_system BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_by_profile_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, code)
);

CREATE TABLE IF NOT EXISTS public.org_bookkeeping_settings (
  organization_id UUID PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  base_currency TEXT DEFAULT 'USD',
  fiscal_year_start_month INT DEFAULT 1,
  default_cash_account_code TEXT DEFAULT '1000',
  default_income_account_code TEXT DEFAULT '4000',
  default_expense_account_code TEXT DEFAULT '6000',
  default_ar_account_code TEXT DEFAULT '1100',
  default_ap_account_code TEXT DEFAULT '2000',
  autopilot_level TEXT DEFAULT 'assist',
  autopilot_min_confidence DECIMAL(3,2) DEFAULT 0.90,
  autopilot_max_amount_cents INT DEFAULT 250000,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  display_name TEXT,
  email TEXT,
  phone TEXT,
  website TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  country TEXT DEFAULT 'US',
  tax_id TEXT,
  is_1099_eligible BOOLEAN DEFAULT false,
  default_account_id UUID REFERENCES public.ledger_accounts(id),
  merchant_patterns TEXT[],
  external_ids JSONB DEFAULT '{}',
  created_by_profile_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, name)
);

CREATE TABLE IF NOT EXISTS public.journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  entry_number TEXT,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT,
  memo TEXT,
  status public.journal_entry_status NOT NULL DEFAULT 'draft',
  source_type TEXT,
  source_id UUID,
  ai_categorized BOOLEAN DEFAULT false,
  ai_confidence DECIMAL(3,2),
  requires_approval BOOLEAN DEFAULT false,
  approved_by_profile_id UUID REFERENCES public.profiles(id),
  approved_at TIMESTAMPTZ,
  created_by_profile_id UUID REFERENCES public.profiles(id),
  posted_by_profile_id UUID REFERENCES public.profiles(id),
  posted_at TIMESTAMPTZ,
  voided_by_profile_id UUID REFERENCES public.profiles(id),
  voided_at TIMESTAMPTZ,
  void_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.journal_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id UUID NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.ledger_accounts(id) ON DELETE RESTRICT,
  debit_cents BIGINT NOT NULL DEFAULT 0,
  credit_cents BIGINT NOT NULL DEFAULT 0,
  functional_expense public.functional_expense,
  fund_id UUID,
  grant_id UUID,
  vendor_id UUID REFERENCES public.vendors(id),
  memo TEXT,
  reconciled BOOLEAN DEFAULT false,
  reconciled_at TIMESTAMPTZ,
  bank_transaction_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT chk_one_sided CHECK (
    (debit_cents >= 0 AND credit_cents >= 0)
    AND NOT (debit_cents > 0 AND credit_cents > 0)
    AND NOT (debit_cents = 0 AND credit_cents = 0)
  )
);

CREATE TABLE IF NOT EXISTS public.bank_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'plaid',
  provider_item_id TEXT,
  institution_id TEXT,
  institution_name TEXT,
  institution_logo TEXT,
  access_token_encrypted TEXT,
  status TEXT DEFAULT 'active',
  error_code TEXT,
  error_message TEXT,
  last_synced_at TIMESTAMPTZ,
  last_cursor TEXT,
  created_by_profile_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, provider, provider_item_id)
);

CREATE TABLE IF NOT EXISTS public.bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  connection_id UUID REFERENCES public.bank_connections(id) ON DELETE CASCADE,
  provider_account_id TEXT,
  name TEXT NOT NULL,
  official_name TEXT,
  mask TEXT,
  type TEXT,
  subtype TEXT,
  iso_currency_code TEXT DEFAULT 'USD',
  ledger_account_id UUID REFERENCES public.ledger_accounts(id),
  current_balance_cents BIGINT DEFAULT 0,
  available_balance_cents BIGINT DEFAULT 0,
  balance_updated_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  auto_import BOOLEAN DEFAULT true,
  auto_categorize BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, provider_account_id)
);

CREATE TABLE IF NOT EXISTS public.bank_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  bank_account_id UUID NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
  provider_transaction_id TEXT,
  date DATE NOT NULL,
  posted_date DATE,
  amount_cents BIGINT NOT NULL,
  iso_currency_code TEXT DEFAULT 'USD',
  name TEXT,
  merchant_name TEXT,
  description TEXT,
  original_description TEXT,
  pending BOOLEAN DEFAULT false,
  provider_category JSONB,
  provider_category_id TEXT,
  ai_status public.bank_tx_status DEFAULT 'new',
  ai_account_id UUID REFERENCES public.ledger_accounts(id),
  ai_confidence DECIMAL(3,2),
  ai_memo TEXT,
  ai_reasoning TEXT,
  ai_categorized_at TIMESTAMPTZ,
  user_account_id UUID REFERENCES public.ledger_accounts(id),
  user_memo TEXT,
  user_categorized_at TIMESTAMPTZ,
  categorized_by_profile_id UUID REFERENCES public.profiles(id),
  final_account_id UUID REFERENCES public.ledger_accounts(id),
  journal_entry_id UUID REFERENCES public.journal_entries(id),
  matched_at TIMESTAMPTZ,
  vendor_id UUID REFERENCES public.vendors(id),
  rule_id UUID,
  location JSONB,
  payment_channel TEXT,
  raw JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, provider_transaction_id)
);

CREATE TABLE IF NOT EXISTS public.bank_transaction_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  bank_transaction_id UUID NOT NULL REFERENCES public.bank_transactions(id) ON DELETE CASCADE,
  journal_entry_id UUID REFERENCES public.journal_entries(id) ON DELETE SET NULL,
  match_type TEXT DEFAULT 'auto',
  match_confidence DECIMAL(3,2) DEFAULT 1.0,
  matched_by_profile_id UUID REFERENCES public.profiles(id),
  matched_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(bank_transaction_id)
);

CREATE TABLE IF NOT EXISTS public.categorization_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  match_type TEXT NOT NULL,
  match_field TEXT NOT NULL,
  match_value TEXT NOT NULL,
  case_sensitive BOOLEAN DEFAULT false,
  min_amount_cents BIGINT,
  max_amount_cents BIGINT,
  account_id UUID NOT NULL REFERENCES public.ledger_accounts(id),
  memo_template TEXT,
  functional_expense public.functional_expense,
  vendor_id UUID REFERENCES public.vendors(id),
  priority INT DEFAULT 0,
  times_applied INT DEFAULT 0,
  last_applied_at TIMESTAMPTZ,
  source TEXT DEFAULT 'user',
  is_active BOOLEAN DEFAULT true,
  created_by_profile_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.ai_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  provider TEXT DEFAULT 'openai',
  model TEXT,
  confidence DECIMAL(3,2) NOT NULL,
  suggestion JSONB NOT NULL,
  rationale TEXT,
  accepted BOOLEAN,
  accepted_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  modified_account_id UUID,
  created_by_profile_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, entity_type, entity_id)
);

CREATE TABLE IF NOT EXISTS public.receipt_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT,
  file_type TEXT,
  status TEXT DEFAULT 'pending',
  extracted_data JSONB,
  confidence_score DECIMAL(3,2),
  vendor_id UUID REFERENCES public.vendors(id),
  journal_entry_id UUID REFERENCES public.journal_entries(id),
  processing_started_at TIMESTAMPTZ,
  processing_completed_at TIMESTAMPTZ,
  error_message TEXT,
  uploaded_by_profile_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  fiscal_year INT NOT NULL,
  budget_type TEXT DEFAULT 'annual',
  grant_id UUID,
  project_id UUID,
  status TEXT DEFAULT 'draft',
  total_budget_cents BIGINT DEFAULT 0,
  total_actual_cents BIGINT DEFAULT 0,
  approved_by_profile_id UUID REFERENCES public.profiles(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.budget_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id UUID NOT NULL REFERENCES public.budgets(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.ledger_accounts(id),
  jan_cents BIGINT DEFAULT 0,
  feb_cents BIGINT DEFAULT 0,
  mar_cents BIGINT DEFAULT 0,
  apr_cents BIGINT DEFAULT 0,
  may_cents BIGINT DEFAULT 0,
  jun_cents BIGINT DEFAULT 0,
  jul_cents BIGINT DEFAULT 0,
  aug_cents BIGINT DEFAULT 0,
  sep_cents BIGINT DEFAULT 0,
  oct_cents BIGINT DEFAULT 0,
  nov_cents BIGINT DEFAULT 0,
  dec_cents BIGINT DEFAULT 0,
  annual_budget_cents BIGINT DEFAULT 0,
  actual_cents BIGINT DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(budget_id, account_id)
);

CREATE TABLE IF NOT EXISTS public.cash_flow_forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  forecast_date DATE NOT NULL,
  predicted_inflows_cents BIGINT DEFAULT 0,
  predicted_outflows_cents BIGINT DEFAULT 0,
  predicted_balance_cents BIGINT DEFAULT 0,
  confidence_score DECIMAL(3,2),
  components JSONB,
  actual_inflows_cents BIGINT,
  actual_outflows_cents BIGINT,
  actual_balance_cents BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, forecast_date)
);

CREATE TABLE IF NOT EXISTS public.financial_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  insight_type TEXT NOT NULL,
  severity TEXT DEFAULT 'info',
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  data JSONB,
  action_type TEXT,
  action_url TEXT,
  is_read BOOLEAN DEFAULT false,
  is_dismissed BOOLEAN DEFAULT false,
  is_acted_on BOOLEAN DEFAULT false,
  valid_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.reconciliations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  bank_account_id UUID NOT NULL REFERENCES public.bank_accounts(id),
  statement_date DATE NOT NULL,
  statement_ending_balance_cents BIGINT NOT NULL,
  cleared_balance_cents BIGINT DEFAULT 0,
  difference_cents BIGINT DEFAULT 0,
  status TEXT DEFAULT 'in_progress',
  completed_by_profile_id UUID REFERENCES public.profiles(id),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.financial_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  period_name TEXT NOT NULL,
  period_type TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT DEFAULT 'open',
  soft_closed_by_profile_id UUID REFERENCES public.profiles(id),
  soft_closed_at TIMESTAMPTZ,
  hard_closed_by_profile_id UUID REFERENCES public.profiles(id),
  hard_closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, period_type, start_date)
);

-- =====================
-- Post Journal Entry Function
-- =====================

CREATE OR REPLACE FUNCTION public.post_journal_entry(p_entry_id uuid, p_posted_by uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_status text;
  v_debits bigint;
  v_credits bigint;
BEGIN
  SELECT organization_id, status INTO v_org_id, v_status 
  FROM journal_entries WHERE id = p_entry_id;
  
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Journal entry not found';
  END IF;
  
  IF v_status = 'posted' THEN
    RAISE EXCEPTION 'Already posted';
  END IF;
  
  IF v_status = 'void' THEN
    RAISE EXCEPTION 'Cannot post voided entry';
  END IF;

  IF NOT has_org_role(v_org_id, ARRAY['owner','admin','staff','finance']) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT COALESCE(SUM(debit_cents),0), COALESCE(SUM(credit_cents),0)
    INTO v_debits, v_credits
  FROM journal_lines WHERE journal_entry_id = p_entry_id;

  IF v_debits = 0 AND v_credits = 0 THEN
    RAISE EXCEPTION 'No lines';
  END IF;
  
  IF v_debits <> v_credits THEN
    RAISE EXCEPTION 'Not balanced: debits=%, credits=%', v_debits, v_credits;
  END IF;

  UPDATE journal_entries
  SET status = 'posted', posted_by_profile_id = p_posted_by, 
      posted_at = NOW(), updated_at = NOW()
  WHERE id = p_entry_id;

  UPDATE ledger_accounts la
  SET current_balance_cents = current_balance_cents + 
    CASE WHEN la.normal_balance = 'debit' THEN jl.debit_cents - jl.credit_cents
         ELSE jl.credit_cents - jl.debit_cents END,
    updated_at = NOW()
  FROM journal_lines jl
  WHERE jl.journal_entry_id = p_entry_id AND jl.account_id = la.id;
END;
$$;

-- =====================
-- Indexes
-- =====================

CREATE INDEX IF NOT EXISTS idx_ledger_accounts_org ON public.ledger_accounts(organization_id, code);
CREATE INDEX IF NOT EXISTS idx_journal_entries_org_date ON public.journal_entries(organization_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_journal_lines_entry ON public.journal_lines(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_org ON public.bank_transactions(organization_id, ai_status);
CREATE INDEX IF NOT EXISTS idx_categorization_rules_org ON public.categorization_rules(organization_id, is_active);
CREATE INDEX IF NOT EXISTS idx_ai_suggestions_entity ON public.ai_suggestions(organization_id, entity_type, entity_id);

-- =====================
-- Enable RLS
-- =====================

ALTER TABLE public.ledger_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_bookkeeping_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_transaction_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categorization_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipt_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_flow_forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reconciliations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_periods ENABLE ROW LEVEL SECURITY;

-- =====================
-- RLS Policies - Tables with organization_id
-- =====================

-- ledger_accounts
CREATE POLICY "ledger_accounts_read" ON public.ledger_accounts
  FOR SELECT USING (is_org_member(organization_id));
CREATE POLICY "ledger_accounts_write" ON public.ledger_accounts
  FOR ALL USING (has_org_role(organization_id, ARRAY['owner','admin','staff','finance']));

-- org_bookkeeping_settings
CREATE POLICY "settings_read" ON public.org_bookkeeping_settings
  FOR SELECT USING (is_org_member(organization_id));
CREATE POLICY "settings_write" ON public.org_bookkeeping_settings
  FOR ALL USING (has_org_role(organization_id, ARRAY['owner','admin','staff','finance']));

-- vendors
CREATE POLICY "vendors_read" ON public.vendors
  FOR SELECT USING (is_org_member(organization_id));
CREATE POLICY "vendors_write" ON public.vendors
  FOR ALL USING (has_org_role(organization_id, ARRAY['owner','admin','staff','finance']));

-- journal_entries
CREATE POLICY "je_read" ON public.journal_entries
  FOR SELECT USING (is_org_member(organization_id));
CREATE POLICY "je_write" ON public.journal_entries
  FOR ALL USING (has_org_role(organization_id, ARRAY['owner','admin','staff','finance']));

-- journal_lines
CREATE POLICY "jl_read" ON public.journal_lines
  FOR SELECT USING (is_org_member(organization_id));
CREATE POLICY "jl_write" ON public.journal_lines
  FOR ALL USING (has_org_role(organization_id, ARRAY['owner','admin','staff','finance']));

-- bank_connections
CREATE POLICY "bc_read" ON public.bank_connections
  FOR SELECT USING (is_org_member(organization_id));
CREATE POLICY "bc_write" ON public.bank_connections
  FOR ALL USING (has_org_role(organization_id, ARRAY['owner','admin','staff','finance']));

-- bank_accounts
CREATE POLICY "ba_read" ON public.bank_accounts
  FOR SELECT USING (is_org_member(organization_id));
CREATE POLICY "ba_write" ON public.bank_accounts
  FOR ALL USING (has_org_role(organization_id, ARRAY['owner','admin','staff','finance']));

-- bank_transactions
CREATE POLICY "bt_read" ON public.bank_transactions
  FOR SELECT USING (is_org_member(organization_id));
CREATE POLICY "bt_write" ON public.bank_transactions
  FOR ALL USING (has_org_role(organization_id, ARRAY['owner','admin','staff','finance']));

-- bank_transaction_matches
CREATE POLICY "btm_read" ON public.bank_transaction_matches
  FOR SELECT USING (is_org_member(organization_id));
CREATE POLICY "btm_write" ON public.bank_transaction_matches
  FOR ALL USING (has_org_role(organization_id, ARRAY['owner','admin','staff','finance']));

-- categorization_rules
CREATE POLICY "cr_read" ON public.categorization_rules
  FOR SELECT USING (is_org_member(organization_id));
CREATE POLICY "cr_write" ON public.categorization_rules
  FOR ALL USING (has_org_role(organization_id, ARRAY['owner','admin','staff','finance']));

-- ai_suggestions
CREATE POLICY "ai_read" ON public.ai_suggestions
  FOR SELECT USING (is_org_member(organization_id));
CREATE POLICY "ai_write" ON public.ai_suggestions
  FOR ALL USING (has_org_role(organization_id, ARRAY['owner','admin','staff','finance']));

-- receipt_scans
CREATE POLICY "rs_read" ON public.receipt_scans
  FOR SELECT USING (is_org_member(organization_id));
CREATE POLICY "rs_write" ON public.receipt_scans
  FOR ALL USING (has_org_role(organization_id, ARRAY['owner','admin','staff','finance']));

-- budgets
CREATE POLICY "budgets_read" ON public.budgets
  FOR SELECT USING (is_org_member(organization_id));
CREATE POLICY "budgets_write" ON public.budgets
  FOR ALL USING (has_org_role(organization_id, ARRAY['owner','admin','staff','finance']));

-- cash_flow_forecasts
CREATE POLICY "cff_read" ON public.cash_flow_forecasts
  FOR SELECT USING (is_org_member(organization_id));
CREATE POLICY "cff_write" ON public.cash_flow_forecasts
  FOR ALL USING (has_org_role(organization_id, ARRAY['owner','admin','staff','finance']));

-- financial_insights
CREATE POLICY "fi_read" ON public.financial_insights
  FOR SELECT USING (is_org_member(organization_id));
CREATE POLICY "fi_write" ON public.financial_insights
  FOR ALL USING (has_org_role(organization_id, ARRAY['owner','admin','staff','finance']));

-- reconciliations
CREATE POLICY "rec_read" ON public.reconciliations
  FOR SELECT USING (is_org_member(organization_id));
CREATE POLICY "rec_write" ON public.reconciliations
  FOR ALL USING (has_org_role(organization_id, ARRAY['owner','admin','staff','finance']));

-- financial_periods
CREATE POLICY "fp_read" ON public.financial_periods
  FOR SELECT USING (is_org_member(organization_id));
CREATE POLICY "fp_write" ON public.financial_periods
  FOR ALL USING (has_org_role(organization_id, ARRAY['owner','admin','staff','finance']));

-- =====================
-- budget_lines (joins to budgets for org_id)
-- =====================

CREATE POLICY "bl_read" ON public.budget_lines FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.budgets b WHERE b.id = budget_id AND is_org_member(b.organization_id)
  ));

CREATE POLICY "bl_write" ON public.budget_lines FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.budgets b WHERE b.id = budget_id AND has_org_role(b.organization_id, ARRAY['owner','admin','staff','finance'])
  ));

-- =====================================================
-- END MIGRATION 007
-- =====================================================
