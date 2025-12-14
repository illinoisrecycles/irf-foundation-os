# AI Bookkeeping Guardrails (Production)

AI can dramatically reduce bookkeeping work, but you only get "better than QuickBooks" when the system is:
1) Explainable
2) Auditable  
3) Reversible
4) Policy-controlled

## Autopilot Levels

**Level 0 (Off):** No AI categorization

**Level 1 (Assist - Default):** AI suggests category + posting template; human approves

**Level 2 (Bounded Autopilot):** AI can auto-post only when:
- Confidence >= 0.90
- Amount <= threshold (default $2,500)
- Matches a known vendor/account rule

**Level 3 (Continuous Close):** Auto-post + auto-match daily, but:
- Exceptions queue for review
- Weekly review required

## Security Controls

### No Blind Posts
- Journal entries are "draft" until posted
- Posting uses DB function `post_journal_entry()` that enforces balanced entries
- Cannot post unbalanced entries at database level

### Explainability
- Every AI suggestion stored in `ai_suggestions` table
- Includes: provider, model, confidence, full suggestion JSON, rationale
- Tracks acceptance/rejection for learning

### Data Minimization
- Never send bank account numbers or PANs to AI
- Only send: merchant name, description, amount, date
- Chart of accounts for context

### Strict Schema
- Uses OpenAI Structured Outputs (JSON schema)
- Model cannot hallucinate invalid fields

### Human Override
- Every auto-post has one-click "void + reverse" path
- Void creates reversing entry, original stays for audit

### Close Periods
- `financial_periods` table tracks open/closed periods
- Prevent postings into closed periods except admin override

## RLS Security

All bookkeeping tables use Row-Level Security:
- **Read:** All org members can read
- **Write:** Only `owner`, `admin`, `staff`, `finance` roles

API routes use `requireOrgContext()` which:
- Never trusts `orgId` from query params
- Validates membership via RLS-enforced query
- Uses anon key + session cookies (not service role)

## Quality Loop

1. Treat every approval/rejection as labeled training data
2. Prefer deterministic rules over AI once patterns are clear
3. Track drift: vendor name changes, category changes, unusual amounts
4. Monthly review of AI suggestion acceptance rate
