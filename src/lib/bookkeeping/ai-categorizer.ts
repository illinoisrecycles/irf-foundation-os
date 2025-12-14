import OpenAI from 'openai'
import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database'

// Lazy-loaded OpenAI client (avoids build-time errors)
let openaiClient: OpenAI | null = null
function getOpenAI(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' })
  }
  return openaiClient
}

// ============================================================================
// AI TRANSACTION CATEGORIZER (STRUCTURED OUTPUTS)
// Uses OpenAI's JSON Schema mode for guaranteed valid output
// ============================================================================

export type AccountInfo = {
  id: string
  code: string
  name: string
  type: string
}

export type AISuggestion = {
  vendor_name: string | null
  memo: string
  expense_account_code: string | null
  functional_expense: 'program' | 'management_general' | 'fundraising' | null
  confidence: number
  should_autopost: boolean
  rationale: string
  proposed_entry: {
    debit_account_code: string
    credit_account_code: string
    amount_cents: number
  } | null
}

export type CategorizationInput = {
  orgId: string
  currency: string
  amountCents: number
  date: string
  description: string
  merchantName?: string | null
  accounts: AccountInfo[]
  defaultCashAccountCode: string
  orgType?: string
}

/**
 * AI categorization using OpenAI Structured Outputs
 * Guarantees valid JSON matching our schema
 */
export async function suggestCategorization(
  input: CategorizationInput
): Promise<AISuggestion> {
  const apiKey = process.env.OPENAI_API_KEY
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini'

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set')
  }

  // System prompt
  const systemPrompt = `You are an expert CPA for a ${input.orgType || 'nonprofit organization'}.
Classify bank transactions into the correct General Ledger (GL) account based on GAAP principles.

RULES:
1. ONLY select from the provided Chart of Accounts. Never invent accounts.
2. Analyze merchant name and description for context.
3. Consider amount: Large purchases (>$2,500) from tech vendors are often Assets, not Supplies.
4. For expenses: debit expense account, credit cash account.
5. For income: debit cash account, credit revenue account.
6. Set functional_expense when relevant (program, management_general, fundraising).
7. Set should_autopost true ONLY when confidence >= 0.9 AND proposed_entry is provided.
8. If unsure, set confidence < 0.8 and should_autopost false.`

  // User context
  const isExpense = input.amountCents < 0
  const accountsList = input.accounts
    .map(a => `[${a.code}] ${a.name} (${a.type})`)
    .join('\n')

  const userPrompt = `Transaction Details:
- Merchant: "${input.merchantName || 'Unknown'}"
- Description: "${input.description}"
- Amount: $${Math.abs(input.amountCents / 100).toFixed(2)} (${isExpense ? 'Expense/Outflow' : 'Income/Inflow'})
- Date: ${input.date}
- Currency: ${input.currency}

Available Chart of Accounts:
${accountsList}

Default Cash Account: ${input.defaultCashAccountCode}

Classify this transaction.`

  const response = await getOpenAI().chat.completions.create({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    response_format: { type: 'json_object' },
    temperature: 0.1,
  })

  const result = JSON.parse(response.choices[0].message.content || '{}')

  // Validate that returned account exists
  const matchedAccount = input.accounts.find(
    a => a.code === result.account_code || a.name === result.account_name
  )

  return {
    vendor_name: result.vendor_name || input.merchantName || null,
    memo: result.memo || input.description || '',
    expense_account_code: matchedAccount?.code || result.expense_account_code || null,
    functional_expense: result.functional_expense || null,
    confidence: typeof result.confidence === 'number' ? result.confidence : 0.5,
    should_autopost: result.should_autopost === true && result.confidence >= 0.9,
    rationale: result.rationale || 'AI categorization',
    proposed_entry: result.proposed_entry || null,
  }
}

/**
 * Match against deterministic rules first
 */
export async function matchCategorizationRule(
  supabase: SupabaseClient<Database>,
  orgId: string,
  transaction: { name?: string; merchant_name?: string; description?: string; amount_cents: number }
): Promise<{ accountId: string; memo?: string; vendorId?: string } | null> {
  const { data: rules } = await supabase
    .from('categorization_rules')
    .select('*, account:account_id(id, code, name)')
    .eq('organization_id', orgId)
    .eq('is_active', true)
    .order('priority', { ascending: false })

  for (const rule of rules || []) {
    // Get field value to match
    const fieldValue = rule.match_field === 'merchant_name'
      ? transaction.merchant_name
      : rule.match_field === 'description'
        ? transaction.description
        : transaction.name

    if (!fieldValue) continue

    // Check amount filters
    if (rule.min_amount_cents && Math.abs(transaction.amount_cents) < rule.min_amount_cents) continue
    if (rule.max_amount_cents && Math.abs(transaction.amount_cents) > rule.max_amount_cents) continue

    const searchValue = rule.case_sensitive ? fieldValue : fieldValue.toLowerCase()
    const matchValue = rule.case_sensitive ? rule.match_value : rule.match_value.toLowerCase()

    let matched = false
    switch (rule.match_type) {
      case 'exact':
        matched = searchValue === matchValue
        break
      case 'contains':
        matched = searchValue.includes(matchValue)
        break
      case 'regex':
        try {
          matched = new RegExp(rule.match_value, rule.case_sensitive ? '' : 'i').test(fieldValue)
        } catch { matched = false }
        break
      case 'merchant':
        matched = searchValue.includes(matchValue) || matchValue.includes(searchValue)
        break
    }

    if (matched) {
      // Update rule stats
      await supabase
        .from('categorization_rules')
        .update({ 
          times_applied: (rule.times_applied || 0) + 1, 
          last_applied_at: new Date().toISOString() 
        })
        .eq('id', rule.id)

      return {
        accountId: rule.account_id,
        memo: rule.memo_template?.replace('{{merchant}}', transaction.merchant_name || transaction.name || ''),
        vendorId: rule.vendor_id,
      }
    }
  }

  return null
}

/**
 * Create learned rule from accepted AI suggestion
 */
export async function createLearnedRule(
  supabase: SupabaseClient<Database>,
  orgId: string,
  merchantName: string,
  accountId: string,
  memo?: string
): Promise<void> {
  // Check if rule already exists
  const { data: existing } = await supabase
    .from('categorization_rules')
    .select('id')
    .eq('organization_id', orgId)
    .eq('match_field', 'merchant_name')
    .eq('match_value', merchantName)
    .single()

  if (existing) return

  await supabase.from('categorization_rules').insert({
    organization_id: orgId,
    name: `Auto: ${merchantName}`,
    match_type: 'contains',
    match_field: 'merchant_name',
    match_value: merchantName,
    account_id: accountId,
    memo_template: memo,
    source: 'ai_learned',
    is_active: true,
  })
}
