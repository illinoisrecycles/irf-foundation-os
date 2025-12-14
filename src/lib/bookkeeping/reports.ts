import { createAdminClient } from '@/lib/supabase/admin'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

// ============================================================================
// FINANCIAL REPORTS
// Auto-generated P&L, Balance Sheet, Cash Flow Statement, 990 Prep
// ============================================================================

export type ReportPeriod = {
  startDate: string
  endDate: string
  compareStartDate?: string
  compareEndDate?: string
}

/**
 * Generate Profit & Loss (Income Statement)
 */
export async function generateProfitLoss(
  organizationId: string,
  period: ReportPeriod
): Promise<{
  revenue: { account: string; amount: number }[]
  expenses: { account: string; amount: number }[]
  totalRevenue: number
  totalExpenses: number
  netIncome: number
  comparison?: { totalRevenue: number; totalExpenses: number; netIncome: number }
}> {
  const supabase = createAdminClient()

  // Get revenue accounts
  const { data: revenueAccounts } = await supabase
    .from('chart_of_accounts')
    .select(`
      id, name, account_number,
      journal_entry_lines(amount_cents, line_type, journal_entries!inner(entry_date, status))
    `)
    .eq('organization_id', organizationId)
    .eq('account_type', 'revenue')
    .eq('journal_entry_lines.journal_entries.status', 'posted')
    .gte('journal_entry_lines.journal_entries.entry_date', period.startDate)
    .lte('journal_entry_lines.journal_entries.entry_date', period.endDate)

  // Get expense accounts
  const { data: expenseAccounts } = await supabase
    .from('chart_of_accounts')
    .select(`
      id, name, account_number,
      journal_entry_lines(amount_cents, line_type, journal_entries!inner(entry_date, status))
    `)
    .eq('organization_id', organizationId)
    .eq('account_type', 'expense')
    .eq('journal_entry_lines.journal_entries.status', 'posted')
    .gte('journal_entry_lines.journal_entries.entry_date', period.startDate)
    .lte('journal_entry_lines.journal_entries.entry_date', period.endDate)

  const revenue: { account: string; amount: number }[] = []
  let totalRevenue = 0

  for (const account of revenueAccounts || []) {
    let amount = 0
    for (const line of account.journal_entry_lines || []) {
      // Revenue is normally credit
      if (line.line_type === 'credit') amount += line.amount_cents
      else amount -= line.amount_cents
    }
    if (amount !== 0) {
      revenue.push({ account: `${account.account_number} - ${account.name}`, amount })
      totalRevenue += amount
    }
  }

  const expenses: { account: string; amount: number }[] = []
  let totalExpenses = 0

  for (const account of expenseAccounts || []) {
    let amount = 0
    for (const line of account.journal_entry_lines || []) {
      // Expenses are normally debit
      if (line.line_type === 'debit') amount += line.amount_cents
      else amount -= line.amount_cents
    }
    if (amount !== 0) {
      expenses.push({ account: `${account.account_number} - ${account.name}`, amount })
      totalExpenses += amount
    }
  }

  return {
    revenue: revenue.sort((a, b) => b.amount - a.amount),
    expenses: expenses.sort((a, b) => b.amount - a.amount),
    totalRevenue,
    totalExpenses,
    netIncome: totalRevenue - totalExpenses,
  }
}

/**
 * Generate Balance Sheet
 */
export async function generateBalanceSheet(
  organizationId: string,
  asOfDate: string
): Promise<{
  assets: { category: string; accounts: { name: string; balance: number }[] }[]
  liabilities: { category: string; accounts: { name: string; balance: number }[] }[]
  equity: { category: string; accounts: { name: string; balance: number }[] }[]
  totalAssets: number
  totalLiabilities: number
  totalEquity: number
}> {
  const supabase = createAdminClient()

  const { data: accounts } = await supabase
    .from('chart_of_accounts')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .in('account_type', ['asset', 'liability', 'equity'])
    .order('account_number')

  const assets: { category: string; accounts: { name: string; balance: number }[] }[] = []
  const liabilities: { category: string; accounts: { name: string; balance: number }[] }[] = []
  const equity: { category: string; accounts: { name: string; balance: number }[] }[] = []

  let totalAssets = 0
  let totalLiabilities = 0
  let totalEquity = 0

  const categorize = (type: string) => {
    const typeAccounts = accounts?.filter(a => a.account_type === type) || []
    const bySubtype: Record<string, { name: string; balance: number }[]> = {}

    for (const account of typeAccounts) {
      const subtype = account.account_subtype || 'Other'
      if (!bySubtype[subtype]) bySubtype[subtype] = []
      bySubtype[subtype].push({
        name: `${account.account_number} - ${account.name}`,
        balance: account.current_balance_cents,
      })

      if (type === 'asset') totalAssets += account.current_balance_cents
      if (type === 'liability') totalLiabilities += account.current_balance_cents
      if (type === 'equity') totalEquity += account.current_balance_cents
    }

    return Object.entries(bySubtype).map(([category, accts]) => ({
      category,
      accounts: accts.filter(a => a.balance !== 0),
    }))
  }

  return {
    assets: categorize('asset'),
    liabilities: categorize('liability'),
    equity: categorize('equity'),
    totalAssets,
    totalLiabilities,
    totalEquity,
  }
}

/**
 * Generate Trial Balance
 */
export async function generateTrialBalance(
  organizationId: string,
  asOfDate: string
): Promise<{
  accounts: { number: string; name: string; debit: number; credit: number }[]
  totalDebits: number
  totalCredits: number
  balanced: boolean
}> {
  const supabase = createAdminClient()

  const { data: accounts } = await supabase
    .from('chart_of_accounts')
    .select('account_number, name, ytd_debits_cents, ytd_credits_cents, normal_balance')
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .order('account_number')

  const result: { number: string; name: string; debit: number; credit: number }[] = []
  let totalDebits = 0
  let totalCredits = 0

  for (const account of accounts || []) {
    const balance = account.ytd_debits_cents - account.ytd_credits_cents
    const debit = account.normal_balance === 'debit' && balance > 0 ? balance : 0
    const credit = account.normal_balance === 'credit' && balance < 0 ? Math.abs(balance) : 
                   (account.normal_balance === 'credit' ? account.ytd_credits_cents - account.ytd_debits_cents : 0)

    if (debit > 0 || credit > 0) {
      result.push({
        number: account.account_number,
        name: account.name,
        debit: debit > 0 ? debit : 0,
        credit: credit > 0 ? credit : 0,
      })
      totalDebits += debit > 0 ? debit : 0
      totalCredits += credit > 0 ? credit : 0
    }
  }

  return {
    accounts: result,
    totalDebits,
    totalCredits,
    balanced: Math.abs(totalDebits - totalCredits) < 100, // Allow $1 rounding
  }
}

/**
 * Generate 990 Preparation Report
 */
export async function generate990Prep(
  organizationId: string,
  fiscalYear: number
): Promise<{
  partI: { grossReceipts: number; contributions: number; programServiceRevenue: number }
  partIX: { expenses: { category: string; total: number; program: number; management: number; fundraising: number }[] }
  scheduleA: { publicSupport: number; totalSupport: number; publicSupportPercentage: number }
}> {
  const supabase = createAdminClient()

  const startDate = `${fiscalYear}-01-01`
  const endDate = `${fiscalYear}-12-31`

  // Get P&L for the year
  const pl = await generateProfitLoss(organizationId, { startDate, endDate })

  // Get donations
  const { data: donations } = await supabase
    .from('donations')
    .select('amount_cents')
    .eq('organization_id', organizationId)
    .gte('donated_at', startDate)
    .lte('donated_at', endDate)
    .eq('payment_status', 'succeeded')

  const totalDonations = donations?.reduce((sum, d) => sum + d.amount_cents, 0) || 0

  // Get membership revenue
  const membershipRevenue = pl.revenue
    .filter(r => r.account.toLowerCase().includes('membership'))
    .reduce((sum, r) => sum + r.amount, 0)

  // Get program service revenue
  const programRevenue = pl.revenue
    .filter(r => r.account.toLowerCase().includes('program') || r.account.toLowerCase().includes('event'))
    .reduce((sum, r) => sum + r.amount, 0)

  return {
    partI: {
      grossReceipts: pl.totalRevenue,
      contributions: totalDonations,
      programServiceRevenue: programRevenue,
    },
    partIX: {
      expenses: [
        {
          category: 'Total Functional Expenses',
          total: pl.totalExpenses,
          program: Math.round(pl.totalExpenses * 0.75), // Estimate
          management: Math.round(pl.totalExpenses * 0.15),
          fundraising: Math.round(pl.totalExpenses * 0.10),
        },
      ],
    },
    scheduleA: {
      publicSupport: totalDonations + membershipRevenue,
      totalSupport: pl.totalRevenue,
      publicSupportPercentage: pl.totalRevenue > 0 
        ? ((totalDonations + membershipRevenue) / pl.totalRevenue) * 100 
        : 0,
    },
  }
}

/**
 * Generate PDF Financial Report
 */
export async function generateFinancialReportPDF(
  organizationId: string,
  reportType: 'profit_loss' | 'balance_sheet' | 'trial_balance',
  period: ReportPeriod
): Promise<Uint8Array> {
  const supabase = createAdminClient()

  // Get org info
  const { data: org } = await supabase
    .from('organizations')
    .select('name')
    .eq('id', organizationId)
    .single()

  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([612, 792]) // Letter size
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  let y = 750

  // Header
  page.drawText(org?.name || 'Organization', { x: 50, y, font: boldFont, size: 18 })
  y -= 25

  const reportTitle = reportType === 'profit_loss' ? 'Profit & Loss Statement' :
                      reportType === 'balance_sheet' ? 'Balance Sheet' : 'Trial Balance'
  page.drawText(reportTitle, { x: 50, y, font: boldFont, size: 14 })
  y -= 20
  page.drawText(`${period.startDate} to ${period.endDate}`, { x: 50, y, font, size: 10, color: rgb(0.5, 0.5, 0.5) })
  y -= 40

  if (reportType === 'profit_loss') {
    const data = await generateProfitLoss(organizationId, period)

    page.drawText('REVENUE', { x: 50, y, font: boldFont, size: 12 })
    y -= 20

    for (const item of data.revenue) {
      page.drawText(item.account, { x: 60, y, font, size: 10 })
      page.drawText(`$${(item.amount / 100).toLocaleString()}`, { x: 450, y, font, size: 10 })
      y -= 15
    }

    y -= 10
    page.drawText('Total Revenue', { x: 50, y, font: boldFont, size: 11 })
    page.drawText(`$${(data.totalRevenue / 100).toLocaleString()}`, { x: 450, y, font: boldFont, size: 11 })
    y -= 30

    page.drawText('EXPENSES', { x: 50, y, font: boldFont, size: 12 })
    y -= 20

    for (const item of data.expenses) {
      page.drawText(item.account, { x: 60, y, font, size: 10 })
      page.drawText(`$${(item.amount / 100).toLocaleString()}`, { x: 450, y, font, size: 10 })
      y -= 15
    }

    y -= 10
    page.drawText('Total Expenses', { x: 50, y, font: boldFont, size: 11 })
    page.drawText(`$${(data.totalExpenses / 100).toLocaleString()}`, { x: 450, y, font: boldFont, size: 11 })
    y -= 30

    page.drawText('NET INCOME', { x: 50, y, font: boldFont, size: 14 })
    const netColor = data.netIncome >= 0 ? rgb(0, 0.5, 0) : rgb(0.8, 0, 0)
    page.drawText(`$${(data.netIncome / 100).toLocaleString()}`, { x: 450, y, font: boldFont, size: 14, color: netColor })
  }

  return pdfDoc.save()
}

/**
 * Auto-generate and email monthly reports
 */
export async function sendMonthlyReports(organizationId: string): Promise<void> {
  const supabase = createAdminClient()

  const lastMonth = new Date()
  lastMonth.setMonth(lastMonth.getMonth() - 1)
  const startDate = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1).toISOString().split('T')[0]
  const endDate = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0).toISOString().split('T')[0]

  // Generate reports
  const plPdf = await generateFinancialReportPDF(organizationId, 'profit_loss', { startDate, endDate })

  // Get finance users
  const { data: financeUsers } = await supabase
    .from('organization_members')
    .select('profile:profiles(email)')
    .eq('organization_id', organizationId)
    .in('role', ['owner', 'admin', 'finance'])

  // Queue emails with attachments
  for (const user of financeUsers || []) {
    await supabase.from('email_outbox').insert({
      organization_id: organizationId,
      to_email: (user.profile as any)?.email,
      subject: `Monthly Financial Report - ${lastMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}`,
      html_body: `<p>Please find attached your monthly financial reports.</p>`,
      // In production, upload PDF to storage and attach URL
    })
  }
}
