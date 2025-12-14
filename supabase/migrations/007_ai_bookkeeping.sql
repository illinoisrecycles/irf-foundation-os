-- =====================================================
-- MIGRATION 007: AI BOOKKEEPING ENGINE (UNIFIED)
-- Merges security-first design with advanced features
-- =====================================================

-- =====================
-- Helper functions (RLS)
-- =====================

CREATE OR REPLACE FUNCTION public.is_org_member(p_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.organization_id = p_org_id
      AND om.profile_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.has_org_role(p_org_id uuid, p_roles text[])
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.organization_id = p_org_id
      AND om.profile_id = auth.uid()
      AND om.role = ANY(p_roles::user_role[])
  );
$$;

-- =====================
-- Types
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
-- Core Ledger Tables
-- =====================

CREATE TABLE IF NOT EXISTS public.ledger_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  type public.account_type NOT NULL,
  subtype TEXT, -- cash, accounts_receivable, fixed_asset, etc.
  parent_id UUID REFERENCES public.ledger_accounts(id) ON DELETE SET NULL,
  
  -- Nonprofit fund tracking
  fund_type TEXT DEFAULT 'unrestricted', -- unrestricted, temporarily_restricted, permanently_restricted
  
  -- Tax mapping for 990
  tax_line TEXT,
  
  -- Balance tracking (denormalized for performance)
  current_balance_cents BIGINT DEFAULT 0,
  normal_balance TEXT DEFAULT 'debit', -- debit or credit
  
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
  
  -- Default accounts
  default_cash_account_code TEXT DEFAULT '1000',
  default_income_account_code TEXT DEFAULT '4000',
  default_expense_account_code TEXT DEFAULT '6000',
  default_ar_account_code TEXT DEFAULT '1100',
  default_ap_account_code TEXT DEFAULT '2000',
  
  -- AI autopilot settings
  autopilot_level TEXT DEFAULT 'assist', -- off, assist, bounded_autopilot, continuous_close
  autopilot_min_confidence DECIMAL(3,2) DEFAULT 0.90,
  autopilot_max_amount_cents INT DEFAULT 250000, -- $2,500 threshold
  
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
  
  -- Address
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  country TEXT DEFAULT 'US',
  
  -- Tax
  tax_id TEXT,
  is_1099_eligible BOOLEAN DEFAULT false,
  
  -- Default categorization
  default_account_id UUID REFERENCES public.ledger_accounts(id),
  
  -- Merchant matching for AI
  merchant_patterns TEXT[], -- Alternative names in bank feeds
  
  external_ids JSONB DEFAULT '{}',
  
  created_by_profile_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(organization_id, name)
);

-- =====================
-- Journal Entries (Double Entry)
-- =====================

CREATE TABLE IF NOT EXISTS public.journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  entry_number TEXT,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT,
  memo TEXT,
  
  status public.journal_entry_status NOT NULL DEFAULT 'draft',
  
  -- Source linkage for traceability
  source_type TEXT, -- bank_transaction, donation, payment, invoice, grant_disbursement, manual
  source_id UUID,
  
  -- AI categorization info
  ai_categorized BOOLEAN DEFAULT false,
  ai_confidence DECIMAL(3,2),
  
  -- Approval workflow
  requires_approval BOOLEAN DEFAULT false,
  approved_by_profile_id UUID REFERENCES public.profiles(id),
  approved_at TIMESTAMPTZ,
  
  -- Posting info
  created_by_profile_id UUID REFERENCES public.profiles(id),
  posted_by_profile_id UUID REFERENCES public.profiles(id),
  posted_at TIMESTAMPTZ,
  
  -- Void info
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
  
  -- Nonprofit tracking
  functional_expense public.functional_expense,
  fund_id UUID,
  grant_id UUID,
  
  -- Additional context
  vendor_id UUID REFERENCES public.vendors(id),
  memo TEXT,
  
  -- Reconciliation
  reconciled BOOLEAN DEFAULT false,
  reconciled_at TIMESTAMPTZ,
  bank_transaction_id UUID,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure valid entry (either debit or credit, not both)
  CONSTRAINT chk_one_sided CHECK (
    (debit_cents >= 0 AND credit_cents >= 0)
    AND NOT (debit_cents > 0 AND credit_cents > 0)
    AND NOT (debit_cents = 0 AND credit_cents = 0)
  )
);

-- =====================
-- Bank Feed Tables
-- =====================

CREATE TABLE IF NOT EXISTS public.bank_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  provider TEXT NOT NULL DEFAULT 'plaid',
  provider_item_id TEXT,
  
  institution_id TEXT,
  institution_name TEXT,
  institution_logo TEXT,
  
  -- Encrypted access token (encrypt in app layer)
  access_token_encrypted TEXT,
  
  status TEXT DEFAULT 'active', -- active, error, disconnected
  error_code TEXT,
  error_message TEXT,
  
  last_synced_at TIMESTAMPTZ,
  last_cursor TEXT, -- For incremental sync
  
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
  mask TEXT, -- Last 4 digits
  type TEXT, -- checking, savings, credit, loan
  subtype TEXT,
  iso_currency_code TEXT DEFAULT 'USD',
  
  -- Link to ledger
  ledger_account_id UUID REFERENCES public.ledger_accounts(id),
  
  -- Balances
  current_balance_cents BIGINT DEFAULT 0,
  available_balance_cents BIGINT DEFAULT 0,
  balance_updated_at TIMESTAMPTZ,
  
  -- Settings
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
  amount_cents BIGINT NOT NULL, -- Negative = outflow
  iso_currency_code TEXT DEFAULT 'USD',
  
  name TEXT,
  merchant_name TEXT,
  description TEXT,
  original_description TEXT,
  
  pending BOOLEAN DEFAULT false,
  
  -- Provider categorization
  provider_category JSONB,
  provider_category_id TEXT,
  
  -- AI categorization
  ai_status public.bank_tx_status DEFAULT 'new',
  ai_account_id UUID REFERENCES public.ledger_accounts(id),
  ai_confidence DECIMAL(3,2),
  ai_memo TEXT,
  ai_reasoning TEXT,
  ai_categorized_at TIMESTAMPTZ,
  
  -- User override
  user_account_id UUID REFERENCES public.ledger_accounts(id),
  user_memo TEXT,
  user_categorized_at TIMESTAMPTZ,
  categorized_by_profile_id UUID REFERENCES public.profiles(id),
  
  -- Final categorization
  final_account_id UUID REFERENCES public.ledger_accounts(id),
  
  -- Matching
  journal_entry_id UUID REFERENCES public.journal_entries(id),
  matched_at TIMESTAMPTZ,
  
  -- Vendor
  vendor_id UUID REFERENCES public.vendors(id),
  
  -- Rules
  rule_id UUID,
  
  -- Metadata
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
  
  match_type TEXT DEFAULT 'auto', -- auto, manual, rule
  match_confidence DECIMAL(3,2) DEFAULT 1.0,
  
  matched_by_profile_id UUID REFERENCES public.profiles(id),
  matched_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(bank_transaction_id)
);

-- =====================
-- AI & Rules Tables
-- =====================

CREATE TABLE IF NOT EXISTS public.categorization_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  name TEXT NOT NULL,
  
  -- Matching
  match_type TEXT NOT NULL, -- contains, exact, regex, merchant
  match_field TEXT NOT NULL, -- name, merchant_name, description
  match_value TEXT NOT NULL,
  case_sensitive BOOLEAN DEFAULT false,
  
  -- Min/max amount filters
  min_amount_cents BIGINT,
  max_amount_cents BIGINT,
  
  -- Categorization result
  account_id UUID NOT NULL REFERENCES public.ledger_accounts(id),
  memo_template TEXT,
  functional_expense public.functional_expense,
  vendor_id UUID REFERENCES public.vendors(id),
  
  priority INT DEFAULT 0,
  
  -- Stats
  times_applied INT DEFAULT 0,
  last_applied_at TIMESTAMPTZ,
  
  source TEXT DEFAULT 'user', -- user, ai_learned
  
  is_active BOOLEAN DEFAULT true,
  created_by_profile_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.ai_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  entity_type TEXT NOT NULL, -- bank_transaction, invoice, receipt
  entity_id UUID NOT NULL,
  
  provider TEXT DEFAULT 'openai',
  model TEXT,
  
  confidence DECIMAL(3,2) NOT NULL,
  suggestion JSONB NOT NULL, -- Full structured suggestion
  rationale TEXT,
  
  -- Outcome tracking for learning
  accepted BOOLEAN,
  accepted_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  modified_account_id UUID, -- If user changed it
  
  created_by_profile_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(organization_id, entity_type, entity_id)
);

-- =====================
-- Receipt Scanning
-- =====================

CREATE TABLE IF NOT EXISTS public.receipt_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  file_url TEXT NOT NULL,
  file_name TEXT,
  file_type TEXT,
  
  status TEXT DEFAULT 'pending', -- pending, processing, completed, failed
  
  -- Extracted data
  extracted_data JSONB,
  confidence_score DECIMAL(3,2),
  
  -- Created entities
  vendor_id UUID REFERENCES public.vendors(id),
  journal_entry_id UUID REFERENCES public.journal_entries(id),
  
  processing_started_at TIMESTAMPTZ,
  processing_completed_at TIMESTAMPTZ,
  error_message TEXT,
  
  uploaded_by_profile_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================
-- Budgets
-- =====================

CREATE TABLE IF NOT EXISTS public.budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  name TEXT NOT NULL,
  fiscal_year INT NOT NULL,
  budget_type TEXT DEFAULT 'annual', -- annual, project, grant
  
  grant_id UUID,
  project_id UUID,
  
  status TEXT DEFAULT 'draft', -- draft, active, closed
  
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
  
  -- Monthly amounts
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

-- =====================
-- Cash Flow Forecasting
-- =====================

CREATE TABLE IF NOT EXISTS public.cash_flow_forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  forecast_date DATE NOT NULL,
  
  predicted_inflows_cents BIGINT DEFAULT 0,
  predicted_outflows_cents BIGINT DEFAULT 0,
  predicted_balance_cents BIGINT DEFAULT 0,
  
  confidence_score DECIMAL(3,2),
  components JSONB, -- Breakdown of predictions
  
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
  
  insight_type TEXT NOT NULL, -- cash_flow_warning, budget_alert, anomaly, recommendation
  severity TEXT DEFAULT 'info', -- info, warning, critical
  
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

-- =====================
-- Reconciliation
-- =====================

CREATE TABLE IF NOT EXISTS public.reconciliations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  bank_account_id UUID NOT NULL REFERENCES public.bank_accounts(id),
  
  statement_date DATE NOT NULL,
  statement_ending_balance_cents BIGINT NOT NULL,
  
  cleared_balance_cents BIGINT DEFAULT 0,
  difference_cents BIGINT DEFAULT 0,
  
  status TEXT DEFAULT 'in_progress', -- in_progress, completed
  
  completed_by_profile_id UUID REFERENCES public.profiles(id),
  completed_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================
-- Financial Periods
-- =====================

CREATE TABLE IF NOT EXISTS public.financial_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  period_name TEXT NOT NULL,
  period_type TEXT NOT NULL, -- month, quarter, year
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  
  status TEXT DEFAULT 'open', -- open, soft_close, hard_close
  
  soft_closed_by_profile_id UUID REFERENCES public.profiles(id),
  soft_closed_at TIMESTAMPTZ,
  hard_closed_by_profile_id UUID REFERENCES public.profiles(id),
  hard_closed_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(organization_id, period_type, start_date)
);

-- =====================
-- Post Journal Entry Function (Enforces Balance)
-- =====================

CREATE OR REPLACE FUNCTION public.post_journal_entry(p_entry_id uuid, p_posted_by uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_org_id uuid;
  v_status text;
  v_debits bigint;
  v_credits bigint;
BEGIN
  -- Get entry info
  SELECT organization_id, status INTO v_org_id, v_status 
  FROM public.journal_entries WHERE id = p_entry_id;
  
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Journal entry not found';
  END IF;
  
  IF v_status = 'posted' THEN
    RAISE EXCEPTION 'Journal entry already posted';
  END IF;
  
  IF v_status = 'void' THEN
    RAISE EXCEPTION 'Cannot post voided entry';
  END IF;

  -- Verify user has permission (using RLS helper)
  IF NOT public.has_org_role(v_org_id, ARRAY['owner','admin','staff','finance']) THEN
    RAISE EXCEPTION 'Not authorized to post journal entries';
  END IF;

  -- Check balance
  SELECT COALESCE(SUM(debit_cents),0), COALESCE(SUM(credit_cents),0)
    INTO v_debits, v_credits
  FROM public.journal_lines
  WHERE journal_entry_id = p_entry_id;

  IF v_debits = 0 AND v_credits = 0 THEN
    RAISE EXCEPTION 'Journal entry has no lines';
  END IF;
  
  IF v_debits <> v_credits THEN
    RAISE EXCEPTION 'Journal entry is not balanced: debits=%, credits=%', v_debits, v_credits;
  END IF;

  -- Post it
  UPDATE public.journal_entries
  SET status = 'posted', 
      posted_by_profile_id = p_posted_by, 
      posted_at = NOW(), 
      updated_at = NOW()
  WHERE id = p_entry_id;

  -- Update account balances
  UPDATE public.ledger_accounts la
  SET current_balance_cents = current_balance_cents + 
    CASE 
      WHEN la.normal_balance = 'debit' THEN jl.debit_cents - jl.credit_cents
      ELSE jl.credit_cents - jl.debit_cents
    END,
    updated_at = NOW()
  FROM public.journal_lines jl
  WHERE jl.journal_entry_id = p_entry_id
    AND jl.account_id = la.id;

  -- Audit log
  INSERT INTO public.activity_log(
    organization_id, actor_profile_id, action, entity_type, entity_id,
    details
  ) VALUES (
    v_org_id, p_posted_by, 'posted', 'journal_entry', p_entry_id,
    jsonb_build_object('debits_cents', v_debits, 'credits_cents', v_credits)
  );
END;
$$;

-- =====================
-- Indexes
-- =====================

CREATE INDEX IF NOT EXISTS idx_ledger_accounts_org ON public.ledger_accounts(organization_id, code);
CREATE INDEX IF NOT EXISTS idx_ledger_accounts_type ON public.ledger_accounts(organization_id, type);

CREATE INDEX IF NOT EXISTS idx_journal_entries_org_date ON public.journal_entries(organization_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_journal_entries_source ON public.journal_entries(organization_id, source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_status ON public.journal_entries(status);

CREATE INDEX IF NOT EXISTS idx_journal_lines_entry ON public.journal_lines(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_account ON public.journal_lines(organization_id, account_id);

CREATE INDEX IF NOT EXISTS idx_bank_transactions_account ON public.bank_transactions(bank_account_id, date);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_status ON public.bank_transactions(organization_id, ai_status);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_unmatched ON public.bank_transactions(organization_id) 
  WHERE ai_status IN ('new', 'needs_review');

CREATE INDEX IF NOT EXISTS idx_categorization_rules_org ON public.categorization_rules(organization_id, is_active);
CREATE INDEX IF NOT EXISTS idx_ai_suggestions_entity ON public.ai_suggestions(organization_id, entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_receipt_scans_org ON public.receipt_scans(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_financial_insights_org ON public.financial_insights(organization_id, is_read);

-- =====================
-- RLS Policies
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

-- Read policies: org members can read
CREATE POLICY "Org members read ledger_accounts" ON public.ledger_accounts
  FOR SELECT USING (public.is_org_member(organization_id));
CREATE POLICY "Org members read org_bookkeeping_settings" ON public.org_bookkeeping_settings
  FOR SELECT USING (public.is_org_member(organization_id));
CREATE POLICY "Org members read vendors" ON public.vendors
  FOR SELECT USING (public.is_org_member(organization_id));
CREATE POLICY "Org members read journal_entries" ON public.journal_entries
  FOR SELECT USING (public.is_org_member(organization_id));
CREATE POLICY "Org members read journal_lines" ON public.journal_lines
  FOR SELECT USING (public.is_org_member(organization_id));
CREATE POLICY "Org members read bank_connections" ON public.bank_connections
  FOR SELECT USING (public.is_org_member(organization_id));
CREATE POLICY "Org members read bank_accounts" ON public.bank_accounts
  FOR SELECT USING (public.is_org_member(organization_id));
CREATE POLICY "Org members read bank_transactions" ON public.bank_transactions
  FOR SELECT USING (public.is_org_member(organization_id));
CREATE POLICY "Org members read bank_transaction_matches" ON public.bank_transaction_matches
  FOR SELECT USING (public.is_org_member(organization_id));
CREATE POLICY "Org members read categorization_rules" ON public.categorization_rules
  FOR SELECT USING (public.is_org_member(organization_id));
CREATE POLICY "Org members read ai_suggestions" ON public.ai_suggestions
  FOR SELECT USING (public.is_org_member(organization_id));
CREATE POLICY "Org members read receipt_scans" ON public.receipt_scans
  FOR SELECT USING (public.is_org_member(organization_id));
CREATE POLICY "Org members read budgets" ON public.budgets
  FOR SELECT USING (public.is_org_member(organization_id));
CREATE POLICY "Org members read budget_lines" ON public.budget_lines
  FOR SELECT USING (public.is_org_member(budget_id IN (SELECT id FROM public.budgets WHERE public.is_org_member(organization_id))));
CREATE POLICY "Org members read cash_flow_forecasts" ON public.cash_flow_forecasts
  FOR SELECT USING (public.is_org_member(organization_id));
CREATE POLICY "Org members read financial_insights" ON public.financial_insights
  FOR SELECT USING (public.is_org_member(organization_id));
CREATE POLICY "Org members read reconciliations" ON public.reconciliations
  FOR SELECT USING (public.is_org_member(organization_id));
CREATE POLICY "Org members read financial_periods" ON public.financial_periods
  FOR SELECT USING (public.is_org_member(organization_id));

-- Write policies: finance roles can write
CREATE POLICY "Finance manage ledger_accounts" ON public.ledger_accounts
  FOR ALL USING (public.has_org_role(organization_id, ARRAY['owner','admin','staff','finance']))
  WITH CHECK (public.has_org_role(organization_id, ARRAY['owner','admin','staff','finance']));

CREATE POLICY "Finance manage org_bookkeeping_settings" ON public.org_bookkeeping_settings
  FOR ALL USING (public.has_org_role(organization_id, ARRAY['owner','admin','staff','finance']))
  WITH CHECK (public.has_org_role(organization_id, ARRAY['owner','admin','staff','finance']));

CREATE POLICY "Finance manage vendors" ON public.vendors
  FOR ALL USING (public.has_org_role(organization_id, ARRAY['owner','admin','staff','finance']))
  WITH CHECK (public.has_org_role(organization_id, ARRAY['owner','admin','staff','finance']));

CREATE POLICY "Finance manage journal_entries" ON public.journal_entries
  FOR ALL USING (public.has_org_role(organization_id, ARRAY['owner','admin','staff','finance']))
  WITH CHECK (public.has_org_role(organization_id, ARRAY['owner','admin','staff','finance']));

CREATE POLICY "Finance manage journal_lines" ON public.journal_lines
  FOR ALL USING (public.has_org_role(organization_id, ARRAY['owner','admin','staff','finance']))
  WITH CHECK (public.has_org_role(organization_id, ARRAY['owner','admin','staff','finance']));

CREATE POLICY "Finance manage bank_connections" ON public.bank_connections
  FOR ALL USING (public.has_org_role(organization_id, ARRAY['owner','admin','staff','finance']))
  WITH CHECK (public.has_org_role(organization_id, ARRAY['owner','admin','staff','finance']));

CREATE POLICY "Finance manage bank_accounts" ON public.bank_accounts
  FOR ALL USING (public.has_org_role(organization_id, ARRAY['owner','admin','staff','finance']))
  WITH CHECK (public.has_org_role(organization_id, ARRAY['owner','admin','staff','finance']));

CREATE POLICY "Finance manage bank_transactions" ON public.bank_transactions
  FOR ALL USING (public.has_org_role(organization_id, ARRAY['owner','admin','staff','finance']))
  WITH CHECK (public.has_org_role(organization_id, ARRAY['owner','admin','staff','finance']));

CREATE POLICY "Finance manage bank_transaction_matches" ON public.bank_transaction_matches
  FOR ALL USING (public.has_org_role(organization_id, ARRAY['owner','admin','staff','finance']))
  WITH CHECK (public.has_org_role(organization_id, ARRAY['owner','admin','staff','finance']));

CREATE POLICY "Finance manage categorization_rules" ON public.categorization_rules
  FOR ALL USING (public.has_org_role(organization_id, ARRAY['owner','admin','staff','finance']))
  WITH CHECK (public.has_org_role(organization_id, ARRAY['owner','admin','staff','finance']));

CREATE POLICY "Finance manage ai_suggestions" ON public.ai_suggestions
  FOR ALL USING (public.has_org_role(organization_id, ARRAY['owner','admin','staff','finance']))
  WITH CHECK (public.has_org_role(organization_id, ARRAY['owner','admin','staff','finance']));

CREATE POLICY "Finance manage receipt_scans" ON public.receipt_scans
  FOR ALL USING (public.has_org_role(organization_id, ARRAY['owner','admin','staff','finance']))
  WITH CHECK (public.has_org_role(organization_id, ARRAY['owner','admin','staff','finance']));

CREATE POLICY "Finance manage budgets" ON public.budgets
  FOR ALL USING (public.has_org_role(organization_id, ARRAY['owner','admin','staff','finance']))
  WITH CHECK (public.has_org_role(organization_id, ARRAY['owner','admin','staff','finance']));

CREATE POLICY "Finance manage cash_flow_forecasts" ON public.cash_flow_forecasts
  FOR ALL USING (public.has_org_role(organization_id, ARRAY['owner','admin','staff','finance']))
  WITH CHECK (public.has_org_role(organization_id, ARRAY['owner','admin','staff','finance']));

CREATE POLICY "Finance manage financial_insights" ON public.financial_insights
  FOR ALL USING (public.has_org_role(organization_id, ARRAY['owner','admin','staff','finance']))
  WITH CHECK (public.has_org_role(organization_id, ARRAY['owner','admin','staff','finance']));

CREATE POLICY "Finance manage reconciliations" ON public.reconciliations
  FOR ALL USING (public.has_org_role(organization_id, ARRAY['owner','admin','staff','finance']))
  WITH CHECK (public.has_org_role(organization_id, ARRAY['owner','admin','staff','finance']));

CREATE POLICY "Finance manage financial_periods" ON public.financial_periods
  FOR ALL USING (public.has_org_role(organization_id, ARRAY['owner','admin','staff','finance']))
  WITH CHECK (public.has_org_role(organization_id, ARRAY['owner','admin','staff','finance']));

-- =====================================================
-- END MIGRATION 007
-- =====================================================
