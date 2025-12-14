import { NextResponse } from 'next/server'
import { requireContext, handleAuthError } from '@/lib/auth/context'
import { 
  generateProfitLoss, 
  generateBalanceSheet, 
  generateTrialBalance,
  generate990Prep,
  generateFinancialReportPDF 
} from '@/lib/bookkeeping/reports'

export async function GET(req: Request) {
  try {
    const ctx = await requireContext(req)
    const { searchParams } = new URL(req.url)
    
    const reportType = searchParams.get('type') || 'profit_loss'
    const format = searchParams.get('format') || 'json'
    const startDate = searchParams.get('start') || new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]
    const endDate = searchParams.get('end') || new Date().toISOString().split('T')[0]

    let data: any

    switch (reportType) {
      case 'profit_loss':
        data = await generateProfitLoss(ctx.organizationId, { startDate, endDate })
        break
      case 'balance_sheet':
        data = await generateBalanceSheet(ctx.organizationId, endDate)
        break
      case 'trial_balance':
        data = await generateTrialBalance(ctx.organizationId, endDate)
        break
      case '990_prep':
        const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString())
        data = await generate990Prep(ctx.organizationId, year)
        break
      default:
        return NextResponse.json({ error: 'Unknown report type' }, { status: 400 })
    }

    if (format === 'pdf' && ['profit_loss', 'balance_sheet', 'trial_balance'].includes(reportType)) {
      const pdf = await generateFinancialReportPDF(
        ctx.organizationId,
        reportType as any,
        { startDate, endDate }
      )
      return new NextResponse(pdf, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${reportType}_${endDate}.pdf"`,
        },
      })
    }

    return NextResponse.json(data)
  } catch (err) {
    return handleAuthError(err)
  }
}
