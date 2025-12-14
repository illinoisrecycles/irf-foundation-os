import OpenAI from 'openai'
import { createAdminClient } from '@/lib/supabase/admin'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// ============================================================================
// AI CASH FLOW FORECASTING
// Predicts future cash flows based on historical patterns
// ============================================================================

/**
 * Generate 90-day cash flow forecast
 */
export async function generateCashFlowForecast(
  organizationId: string
): Promise<{ forecasts: any[]; insights: string[] }> {
  const supabase = createAdminClient()

  // Get historical data (last 12 months)
  const startDate = new Date()
  startDate.setMonth(startDate.getMonth() - 12)

  const { data: historicalTx } = await supabase
    .from('bank_transactions')
    .select('transaction_date, amount_cents, merchant_name, plaid_category')
    .eq('organization_id', organizationId)
    .gte('transaction_date', startDate.toISOString().split('T')[0])
    .order('transaction_date', { ascending: true })

  // Get upcoming bills
  const { data: upcomingBills } = await supabase
    .from('bills')
    .select('due_date, total_cents, vendor:vendors(name)')
    .eq('organization_id', organizationId)
    .in('status', ['pending', 'approved'])
    .gte('due_date', new Date().toISOString().split('T')[0])
    .order('due_date', { ascending: true })

  // Get recurring transactions
  const { data: recurring } = await supabase
    .from('recurring_transactions')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('is_active', true)

  // Get current balances
  const { data: bankAccounts } = await supabase
    .from('bank_accounts')
    .select('name, current_balance_cents')
    .eq('organization_id', organizationId)
    .eq('is_active', true)

  const currentBalance = bankAccounts?.reduce((sum, a) => sum + (a.current_balance_cents || 0), 0) || 0

  // Analyze patterns with AI
  const analysisPrompt = `Analyze this nonprofit's cash flow and predict the next 90 days.

CURRENT BALANCE: $${(currentBalance / 100).toFixed(2)}

LAST 12 MONTHS TRANSACTIONS (sample):
${(historicalTx || []).slice(0, 100).map(tx => 
  `${tx.transaction_date}: $${(tx.amount_cents / 100).toFixed(2)} - ${tx.merchant_name || 'Unknown'}`
).join('\n')}

UPCOMING BILLS:
${(upcomingBills || []).map(b => 
  `${b.due_date}: $${(b.total_cents / 100).toFixed(2)} - ${(b.vendor as any)?.name || 'Vendor'}`
).join('\n') || 'None'}

RECURRING TRANSACTIONS:
${(recurring || []).map(r => 
  `${r.frequency}: ${r.name} - $${(JSON.parse(r.template_data || '{}').amount_cents / 100).toFixed(2)}`
).join('\n') || 'None'}

Return JSON:
{
  "daily_forecasts": [
    {"date": "YYYY-MM-DD", "predicted_inflows": 0, "predicted_outflows": 0, "predicted_balance": 0, "confidence": 0.0-1.0}
  ],
  "weekly_summaries": [
    {"week_start": "YYYY-MM-DD", "inflows": 0, "outflows": 0, "net": 0}
  ],
  "insights": ["insight 1", "insight 2"],
  "warnings": ["warning if cash will go negative"],
  "recommendations": ["recommendation 1"]
}`

  const response = await openai.chat.completions.create({
    model: 'gpt-4-turbo-preview',
    messages: [{ role: 'user', content: analysisPrompt }],
    response_format: { type: 'json_object' },
    max_tokens: 4000,
  })

  const analysis = JSON.parse(response.choices[0].message.content || '{}')

  // Store forecasts
  const forecasts = []
  for (const day of analysis.daily_forecasts || []) {
    const { data: forecast } = await supabase
      .from('cash_flow_forecasts')
      .upsert({
        organization_id: organizationId,
        forecast_date: day.date,
        predicted_inflows_cents: Math.round((day.predicted_inflows || 0) * 100),
        predicted_outflows_cents: Math.round((day.predicted_outflows || 0) * 100),
        predicted_balance_cents: Math.round((day.predicted_balance || 0) * 100),
        confidence_score: day.confidence || 0.5,
        components: day,
      }, { onConflict: 'organization_id,forecast_date' })
      .select()
      .single()

    forecasts.push(forecast)
  }

  // Create insights
  const allInsights = [
    ...(analysis.insights || []),
    ...(analysis.warnings || []).map((w: string) => `⚠️ ${w}`),
    ...(analysis.recommendations || []).map((r: string) => `💡 ${r}`),
  ]

  for (const insight of allInsights) {
    await supabase.from('financial_insights').insert({
      organization_id: organizationId,
      insight_type: insight.startsWith('⚠️') ? 'cash_flow_warning' : 'recommendation',
      severity: insight.startsWith('⚠️') ? 'warning' : 'info',
      title: 'Cash Flow Forecast',
      description: insight,
      valid_until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    })
  }

  return { forecasts, insights: allInsights }
}

/**
 * Get cash flow summary for dashboard
 */
export async function getCashFlowSummary(organizationId: string): Promise<{
  currentBalance: number
  projectedBalance30Days: number
  projectedBalance90Days: number
  burnRate: number
  runway: number
  trend: 'up' | 'down' | 'stable'
}> {
  const supabase = createAdminClient()

  // Current balance
  const { data: accounts } = await supabase
    .from('bank_accounts')
    .select('current_balance_cents')
    .eq('organization_id', organizationId)
    .eq('is_active', true)

  const currentBalance = accounts?.reduce((sum, a) => sum + (a.current_balance_cents || 0), 0) || 0

  // Get forecasts
  const today = new Date().toISOString().split('T')[0]
  const day30 = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const day90 = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const { data: forecast30 } = await supabase
    .from('cash_flow_forecasts')
    .select('predicted_balance_cents')
    .eq('organization_id', organizationId)
    .eq('forecast_date', day30)
    .single()

  const { data: forecast90 } = await supabase
    .from('cash_flow_forecasts')
    .select('predicted_balance_cents')
    .eq('organization_id', organizationId)
    .eq('forecast_date', day90)
    .single()

  // Calculate burn rate (average monthly outflow)
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setMonth(startOfMonth.getMonth() - 3)

  const { data: recentTx } = await supabase
    .from('bank_transactions')
    .select('amount_cents')
    .eq('organization_id', organizationId)
    .lt('amount_cents', 0)
    .gte('transaction_date', startOfMonth.toISOString().split('T')[0])

  const totalOutflow = recentTx?.reduce((sum, tx) => sum + Math.abs(tx.amount_cents), 0) || 0
  const burnRate = Math.round(totalOutflow / 3) // Monthly average

  // Calculate runway
  const runway = burnRate > 0 ? Math.round(currentBalance / burnRate) : 999

  // Determine trend
  const projectedBalance30 = forecast30?.predicted_balance_cents || currentBalance
  let trend: 'up' | 'down' | 'stable' = 'stable'
  if (projectedBalance30 > currentBalance * 1.05) trend = 'up'
  if (projectedBalance30 < currentBalance * 0.95) trend = 'down'

  return {
    currentBalance,
    projectedBalance30Days: projectedBalance30,
    projectedBalance90Days: forecast90?.predicted_balance_cents || currentBalance,
    burnRate,
    runway,
    trend,
  }
}

/**
 * Detect anomalies in transactions
 */
export async function detectAnomalies(organizationId: string): Promise<{
  anomalies: { transactionId: string; reason: string; severity: string }[]
}> {
  const supabase = createAdminClient()

  // Get recent transactions
  const { data: recentTx } = await supabase
    .from('bank_transactions')
    .select('*')
    .eq('organization_id', organizationId)
    .gte('transaction_date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
    .order('transaction_date', { ascending: false })

  // Get historical averages by merchant
  const { data: historicalTx } = await supabase
    .from('bank_transactions')
    .select('merchant_name, amount_cents')
    .eq('organization_id', organizationId)
    .lt('transaction_date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])

  // Calculate averages
  const merchantAverages: Record<string, { sum: number; count: number; avg: number }> = {}
  for (const tx of historicalTx || []) {
    if (!tx.merchant_name) continue
    if (!merchantAverages[tx.merchant_name]) {
      merchantAverages[tx.merchant_name] = { sum: 0, count: 0, avg: 0 }
    }
    merchantAverages[tx.merchant_name].sum += Math.abs(tx.amount_cents)
    merchantAverages[tx.merchant_name].count++
  }
  for (const merchant of Object.keys(merchantAverages)) {
    merchantAverages[merchant].avg = merchantAverages[merchant].sum / merchantAverages[merchant].count
  }

  const anomalies: { transactionId: string; reason: string; severity: string }[] = []

  for (const tx of recentTx || []) {
    // Check for unusually large transactions
    if (Math.abs(tx.amount_cents) > 1000000) { // Over $10k
      anomalies.push({
        transactionId: tx.id,
        reason: `Unusually large transaction: $${(Math.abs(tx.amount_cents) / 100).toFixed(2)}`,
        severity: 'warning',
      })
    }

    // Check vs merchant average
    if (tx.merchant_name && merchantAverages[tx.merchant_name]) {
      const avg = merchantAverages[tx.merchant_name].avg
      if (Math.abs(tx.amount_cents) > avg * 3) {
        anomalies.push({
          transactionId: tx.id,
          reason: `3x higher than usual for ${tx.merchant_name}`,
          severity: 'info',
        })
      }
    }

    // Check for duplicate transactions
    const duplicates = recentTx?.filter(
      t => t.id !== tx.id &&
        t.amount_cents === tx.amount_cents &&
        t.merchant_name === tx.merchant_name &&
        Math.abs(new Date(t.transaction_date).getTime() - new Date(tx.transaction_date).getTime()) < 3 * 24 * 60 * 60 * 1000
    )
    if (duplicates && duplicates.length > 0) {
      anomalies.push({
        transactionId: tx.id,
        reason: `Possible duplicate transaction`,
        severity: 'warning',
      })
    }
  }

  // Store anomalies as insights
  for (const anomaly of anomalies) {
    await supabase.from('financial_insights').insert({
      organization_id: organizationId,
      insight_type: 'anomaly',
      severity: anomaly.severity,
      title: 'Transaction Anomaly Detected',
      description: anomaly.reason,
      data: { transactionId: anomaly.transactionId },
      action_url: `/admin/bookkeeping/transactions/${anomaly.transactionId}`,
    })
  }

  return { anomalies }
}
