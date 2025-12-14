import type { SupabaseClient } from '@supabase/supabase-js'

// ============================================================================
// BANK RULES ENGINE
// Deterministic rules for auto-categorizing bank transactions
// ============================================================================

export type RuleCondition = {
  field: 'merchant_name' | 'name' | 'memo' | 'amount_cents' | 'category'
  operator: 'equals' | 'contains' | 'starts_with' | 'ends_with' | 'regex' | 'gte' | 'lte' | 'between'
  value: string | number | [number, number]
  case_sensitive?: boolean
}

export type BankRule = {
  id: string
  organization_id: string
  name: string
  priority: number
  is_active: boolean
  conditions: RuleCondition[]
  account_id?: string
  class_id?: string
  project_id?: string
  vendor_id?: string
  tags?: string[]
  memo_template?: string
  match_count: number
  last_matched_at?: string
}

export type BankTransaction = {
  id: string
  merchant_name?: string
  name?: string
  memo?: string
  amount_cents: number
  category?: string
}

export type RuleMatchResult = {
  rule: BankRule
  account_id?: string
  class_id?: string
  project_id?: string
  vendor_id?: string
  tags?: string[]
  memo?: string
}

/**
 * Check if a transaction matches a rule's conditions
 */
export function matchesConditions(
  transaction: BankTransaction,
  conditions: RuleCondition[]
): boolean {
  return conditions.every(condition => {
    const fieldValue = transaction[condition.field as keyof BankTransaction]
    
    if (fieldValue === undefined || fieldValue === null) return false

    switch (condition.operator) {
      case 'equals':
        if (typeof fieldValue === 'string' && typeof condition.value === 'string') {
          return condition.case_sensitive 
            ? fieldValue === condition.value
            : fieldValue.toLowerCase() === condition.value.toLowerCase()
        }
        return fieldValue === condition.value

      case 'contains':
        if (typeof fieldValue === 'string' && typeof condition.value === 'string') {
          return condition.case_sensitive
            ? fieldValue.includes(condition.value)
            : fieldValue.toLowerCase().includes(condition.value.toLowerCase())
        }
        return false

      case 'starts_with':
        if (typeof fieldValue === 'string' && typeof condition.value === 'string') {
          return condition.case_sensitive
            ? fieldValue.startsWith(condition.value)
            : fieldValue.toLowerCase().startsWith(condition.value.toLowerCase())
        }
        return false

      case 'ends_with':
        if (typeof fieldValue === 'string' && typeof condition.value === 'string') {
          return condition.case_sensitive
            ? fieldValue.endsWith(condition.value)
            : fieldValue.toLowerCase().endsWith(condition.value.toLowerCase())
        }
        return false

      case 'regex':
        if (typeof fieldValue === 'string' && typeof condition.value === 'string') {
          const flags = condition.case_sensitive ? '' : 'i'
          const regex = new RegExp(condition.value, flags)
          return regex.test(fieldValue)
        }
        return false

      case 'gte':
        return typeof fieldValue === 'number' && fieldValue >= (condition.value as number)

      case 'lte':
        return typeof fieldValue === 'number' && fieldValue <= (condition.value as number)

      case 'between':
        if (typeof fieldValue === 'number' && Array.isArray(condition.value)) {
          const [min, max] = condition.value
          return fieldValue >= min && fieldValue <= max
        }
        return false

      default:
        return false
    }
  })
}

/**
 * Find the first matching rule for a transaction
 */
export function findMatchingRule(
  transaction: BankTransaction,
  rules: BankRule[]
): RuleMatchResult | null {
  // Sort by priority (higher priority first)
  const sortedRules = [...rules]
    .filter(r => r.is_active)
    .sort((a, b) => b.priority - a.priority)

  for (const rule of sortedRules) {
    const conditions = (rule.conditions as unknown) as RuleCondition[]
    if (matchesConditions(transaction, conditions)) {
      // Apply memo template if present
      let memo = rule.memo_template
      if (memo) {
        memo = memo.replace(/\{merchant_name\}/g, transaction.merchant_name || '')
        memo = memo.replace(/\{name\}/g, transaction.name || '')
        memo = memo.replace(/\{amount\}/g, (transaction.amount_cents / 100).toFixed(2))
      }

      return {
        rule,
        account_id: rule.account_id,
        class_id: rule.class_id,
        project_id: rule.project_id,
        vendor_id: rule.vendor_id,
        tags: rule.tags,
        memo,
      }
    }
  }

  return null
}

/**
 * Apply rules to a batch of transactions
 */
export async function applyRulesToTransactions(
  supabase: SupabaseClient,
  organizationId: string,
  transactionIds: string[]
): Promise<{
  matched: number
  unmatched: number
  results: { transactionId: string; ruleId?: string; applied: boolean }[]
}> {
  // Fetch rules
  const { data: rules, error: rulesErr } = await supabase
    .from('bank_rules')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .order('priority', { ascending: false })

  if (rulesErr) throw rulesErr

  // Fetch transactions
  const { data: transactions, error: txErr } = await supabase
    .from('bank_transactions')
    .select('*')
    .eq('organization_id', organizationId)
    .in('id', transactionIds)

  if (txErr) throw txErr

  const results: { transactionId: string; ruleId?: string; applied: boolean }[] = []
  let matched = 0
  let unmatched = 0

  for (const tx of transactions || []) {
    const match = findMatchingRule(tx, rules || [])

    if (match) {
      matched++
      
      // Update transaction with rule results
      await supabase
        .from('bank_transactions')
        .update({
          suggested_account_id: match.account_id,
          suggested_class_id: match.class_id,
          suggested_project_id: match.project_id,
          suggested_vendor_id: match.vendor_id,
          rule_matched_id: match.rule.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', tx.id)

      // Update rule match count
      await supabase
        .from('bank_rules')
        .update({
          match_count: match.rule.match_count + 1,
          last_matched_at: new Date().toISOString(),
        })
        .eq('id', match.rule.id)

      results.push({ transactionId: tx.id, ruleId: match.rule.id, applied: true })
    } else {
      unmatched++
      results.push({ transactionId: tx.id, applied: false })
    }
  }

  return { matched, unmatched, results }
}

/**
 * Create a rule from a transaction (learn from user categorization)
 */
export function createRuleFromTransaction(
  transaction: BankTransaction,
  categorization: {
    account_id?: string
    class_id?: string
    vendor_id?: string
    project_id?: string
  }
): Omit<BankRule, 'id' | 'organization_id' | 'match_count' | 'last_matched_at'> {
  const conditions: RuleCondition[] = []

  // Use merchant name if available
  if (transaction.merchant_name) {
    conditions.push({
      field: 'merchant_name',
      operator: 'contains',
      value: transaction.merchant_name,
      case_sensitive: false,
    })
  } else if (transaction.name) {
    conditions.push({
      field: 'name',
      operator: 'contains',
      value: transaction.name,
      case_sensitive: false,
    })
  }

  return {
    name: `Auto: ${transaction.merchant_name || transaction.name || 'Transaction'}`,
    priority: 50,
    is_active: true,
    conditions,
    ...categorization,
  }
}
