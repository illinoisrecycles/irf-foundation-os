import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateBoardReportSummary } from '@/lib/ai'

// ============================================================================
// BOARD PACKET PDF GENERATOR
// Professional board reports that save hours of staff time
// ============================================================================

export type BoardPacketOptions = {
  organizationId: string
  period: 'ytd' | 'q1' | 'q2' | 'q3' | 'q4' | 'month' | 'custom'
  startDate?: string
  endDate?: string
  includeFinancials?: boolean
  includeMembers?: boolean
  includeEvents?: boolean
  includeDonations?: boolean
  includeAISummary?: boolean
}

export type BoardPacketData = {
  organization: { name: string; fiscalYearStart: number }
  period: { label: string; start: string; end: string }
  summary: {
    totalMembers: number
    newMembers: number
    expiredMembers: number
    retentionRate: number
    totalRevenue: number
    membershipRevenue: number
    donationRevenue: number
    eventRevenue: number
    totalEvents: number
    totalAttendees: number
    avgAttendance: number
    engagementScore: number
  }
  membershipTrends: { month: string; members: number; new: number; expired: number }[]
  topEvents: { title: string; date: string; attendees: number; revenue: number }[]
  topDonors: { name: string; total: number; gifts: number }[]
  aiSummary?: string
  aiRecommendations?: string[]
}

export async function generateBoardPacketData(options: BoardPacketOptions): Promise<BoardPacketData> {
  const supabase = createAdminClient()

  // Get organization
  const { data: org } = await supabase
    .from('organizations')
    .select('name, settings')
    .eq('id', options.organizationId)
    .single()

  // Calculate date range
  const now = new Date()
  let startDate: Date
  let endDate: Date = now
  let periodLabel: string

  switch (options.period) {
    case 'ytd':
      startDate = new Date(now.getFullYear(), 0, 1)
      periodLabel = `Year to Date ${now.getFullYear()}`
      break
    case 'q1':
      startDate = new Date(now.getFullYear(), 0, 1)
      endDate = new Date(now.getFullYear(), 2, 31)
      periodLabel = `Q1 ${now.getFullYear()}`
      break
    case 'q2':
      startDate = new Date(now.getFullYear(), 3, 1)
      endDate = new Date(now.getFullYear(), 5, 30)
      periodLabel = `Q2 ${now.getFullYear()}`
      break
    case 'q3':
      startDate = new Date(now.getFullYear(), 6, 1)
      endDate = new Date(now.getFullYear(), 8, 30)
      periodLabel = `Q3 ${now.getFullYear()}`
      break
    case 'q4':
      startDate = new Date(now.getFullYear(), 9, 1)
      endDate = new Date(now.getFullYear(), 11, 31)
      periodLabel = `Q4 ${now.getFullYear()}`
      break
    case 'month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1)
      periodLabel = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      break
    default:
      startDate = options.startDate ? new Date(options.startDate) : new Date(now.getFullYear(), 0, 1)
      endDate = options.endDate ? new Date(options.endDate) : now
      periodLabel = `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`
  }

  const startIso = startDate.toISOString()
  const endIso = endDate.toISOString()

  // Fetch all data in parallel
  const [
    { count: totalMembers },
    { count: newMembers },
    { count: expiredMembers },
    { data: payments },
    { data: events },
    { data: donations },
    { data: engagementScores },
  ] = await Promise.all([
    supabase.from('member_organizations').select('*', { count: 'exact', head: true })
      .eq('organization_id', options.organizationId)
      .eq('membership_status', 'active'),
    supabase.from('member_organizations').select('*', { count: 'exact', head: true })
      .eq('organization_id', options.organizationId)
      .gte('joined_at', startIso)
      .lte('joined_at', endIso),
    supabase.from('member_organizations').select('*', { count: 'exact', head: true })
      .eq('organization_id', options.organizationId)
      .eq('membership_status', 'expired')
      .gte('updated_at', startIso),
    supabase.from('payments').select('amount_cents, payment_type')
      .eq('organization_id', options.organizationId)
      .eq('status', 'succeeded')
      .gte('created_at', startIso)
      .lte('created_at', endIso),
    supabase.from('events').select('id, title, start_date, event_registrations(count)')
      .eq('organization_id', options.organizationId)
      .gte('start_date', startIso)
      .lte('start_date', endIso)
      .order('start_date', { ascending: false }),
    supabase.from('donations').select('donor_name, amount_cents')
      .eq('organization_id', options.organizationId)
      .gte('created_at', startIso)
      .lte('created_at', endIso),
    supabase.from('member_engagement_scores').select('score')
      .eq('organization_id', options.organizationId),
  ])

  // Calculate totals
  const membershipRevenue = payments?.filter(p => p.payment_type === 'membership').reduce((sum, p) => sum + p.amount_cents, 0) || 0
  const donationRevenue = donations?.reduce((sum, d) => sum + d.amount_cents, 0) || 0
  const eventRevenue = payments?.filter(p => p.payment_type === 'event').reduce((sum, p) => sum + p.amount_cents, 0) || 0
  const totalRevenue = membershipRevenue + donationRevenue + eventRevenue

  const totalAttendees = events?.reduce((sum, e) => sum + (e.event_registrations?.[0]?.count || 0), 0) || 0
  const avgAttendance = events?.length ? Math.round(totalAttendees / events.length) : 0
  const avgEngagement = engagementScores?.length 
    ? Math.round(engagementScores.reduce((sum, s) => sum + s.score, 0) / engagementScores.length)
    : 0

  const retentionRate = totalMembers && (totalMembers + (expiredMembers || 0)) > 0
    ? Math.round((totalMembers / (totalMembers + (expiredMembers || 0))) * 100)
    : 100

  // Top events
  const topEvents = events?.slice(0, 5).map(e => ({
    title: e.title,
    date: new Date(e.start_date).toLocaleDateString(),
    attendees: e.event_registrations?.[0]?.count || 0,
    revenue: 0, // Would need to join with payments
  })) || []

  // Top donors (aggregate)
  const donorTotals: Record<string, { total: number; gifts: number }> = {}
  for (const d of donations || []) {
    const name = d.donor_name || 'Anonymous'
    if (!donorTotals[name]) donorTotals[name] = { total: 0, gifts: 0 }
    donorTotals[name].total += d.amount_cents
    donorTotals[name].gifts++
  }
  const topDonors = Object.entries(donorTotals)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 10)
    .map(([name, data]) => ({ name, total: data.total, gifts: data.gifts }))

  const data: BoardPacketData = {
    organization: { name: org?.name || 'Organization', fiscalYearStart: 1 },
    period: { label: periodLabel, start: startIso, end: endIso },
    summary: {
      totalMembers: totalMembers || 0,
      newMembers: newMembers || 0,
      expiredMembers: expiredMembers || 0,
      retentionRate,
      totalRevenue,
      membershipRevenue,
      donationRevenue,
      eventRevenue,
      totalEvents: events?.length || 0,
      totalAttendees,
      avgAttendance,
      engagementScore: avgEngagement,
    },
    membershipTrends: [], // Would need monthly aggregation
    topEvents,
    topDonors,
  }

  // Generate AI summary if requested
  if (options.includeAISummary) {
    const aiResult = await generateBoardReportSummary(data)
    data.aiSummary = aiResult.summary
    data.aiRecommendations = aiResult.recommendations
  }

  return data
}

export async function generateBoardPacketPDF(data: BoardPacketData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create()
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  const pageWidth = 612 // Letter
  const pageHeight = 792
  const margin = 50

  // Helper functions
  const addPage = () => {
    const page = pdfDoc.addPage([pageWidth, pageHeight])
    return page
  }

  const drawText = (page: any, text: string, x: number, y: number, options: any = {}) => {
    page.drawText(text, {
      x,
      y,
      size: options.size || 12,
      font: options.bold ? helveticaBold : helvetica,
      color: options.color || rgb(0, 0, 0),
    })
  }

  const formatCurrency = (cents: number) => `$${(cents / 100).toLocaleString()}`
  const formatNumber = (n: number) => n.toLocaleString()

  // PAGE 1: Cover & Executive Summary
  let page = addPage()
  let y = pageHeight - margin

  // Title
  drawText(page, data.organization.name, margin, y, { size: 28, bold: true, color: rgb(0.1, 0.2, 0.4) })
  y -= 40
  drawText(page, 'Board Report', margin, y, { size: 20, color: rgb(0.3, 0.3, 0.3) })
  y -= 25
  drawText(page, data.period.label, margin, y, { size: 14 })
  y -= 15
  drawText(page, `Generated: ${new Date().toLocaleDateString()}`, margin, y, { size: 10, color: rgb(0.5, 0.5, 0.5) })

  y -= 60

  // Executive Summary (AI-generated)
  if (data.aiSummary) {
    drawText(page, 'Executive Summary', margin, y, { size: 16, bold: true, color: rgb(0.1, 0.2, 0.4) })
    y -= 25

    // Word wrap the summary
    const words = data.aiSummary.split(' ')
    let line = ''
    const maxWidth = pageWidth - 2 * margin
    const lineHeight = 16

    for (const word of words) {
      const testLine = line + word + ' '
      const width = helvetica.widthOfTextAtSize(testLine, 11)
      if (width > maxWidth && line) {
        drawText(page, line.trim(), margin, y, { size: 11 })
        y -= lineHeight
        line = word + ' '
      } else {
        line = testLine
      }
    }
    if (line) {
      drawText(page, line.trim(), margin, y, { size: 11 })
      y -= lineHeight
    }
  }

  y -= 30

  // Key Metrics Grid
  drawText(page, 'Key Metrics', margin, y, { size: 16, bold: true, color: rgb(0.1, 0.2, 0.4) })
  y -= 30

  const metrics = [
    ['Total Members', formatNumber(data.summary.totalMembers)],
    ['New Members', formatNumber(data.summary.newMembers)],
    ['Retention Rate', `${data.summary.retentionRate}%`],
    ['Total Revenue', formatCurrency(data.summary.totalRevenue)],
    ['Membership Revenue', formatCurrency(data.summary.membershipRevenue)],
    ['Donation Revenue', formatCurrency(data.summary.donationRevenue)],
    ['Events Held', formatNumber(data.summary.totalEvents)],
    ['Total Attendees', formatNumber(data.summary.totalAttendees)],
    ['Avg Engagement Score', formatNumber(data.summary.engagementScore)],
  ]

  const colWidth = (pageWidth - 2 * margin) / 3
  metrics.forEach((metric, idx) => {
    const col = idx % 3
    const row = Math.floor(idx / 3)
    const x = margin + col * colWidth
    const yPos = y - row * 50

    drawText(page, metric[0], x, yPos, { size: 10, color: rgb(0.5, 0.5, 0.5) })
    drawText(page, metric[1], x, yPos - 15, { size: 18, bold: true })
  })

  y -= Math.ceil(metrics.length / 3) * 50 + 30

  // PAGE 2: Top Events & Donors
  page = addPage()
  y = pageHeight - margin

  drawText(page, 'Top Events', margin, y, { size: 16, bold: true, color: rgb(0.1, 0.2, 0.4) })
  y -= 25

  for (const event of data.topEvents) {
    drawText(page, event.title, margin, y, { size: 11, bold: true })
    drawText(page, `${event.date} • ${event.attendees} attendees`, margin, y - 14, { size: 10, color: rgb(0.5, 0.5, 0.5) })
    y -= 35
  }

  y -= 20
  drawText(page, 'Top Donors', margin, y, { size: 16, bold: true, color: rgb(0.1, 0.2, 0.4) })
  y -= 25

  for (const donor of data.topDonors.slice(0, 10)) {
    drawText(page, donor.name, margin, y, { size: 11 })
    drawText(page, formatCurrency(donor.total), pageWidth - margin - 80, y, { size: 11, bold: true })
    drawText(page, `(${donor.gifts} gifts)`, pageWidth - margin - 80, y - 14, { size: 9, color: rgb(0.5, 0.5, 0.5) })
    y -= 30
  }

  // AI Recommendations
  if (data.aiRecommendations?.length) {
    y -= 30
    drawText(page, 'AI Recommendations', margin, y, { size: 16, bold: true, color: rgb(0.1, 0.2, 0.4) })
    y -= 25

    for (const rec of data.aiRecommendations) {
      drawText(page, `• ${rec}`, margin, y, { size: 11 })
      y -= 20
    }
  }

  return await pdfDoc.save()
}

// API helper
export async function createAndStoreBoardPacket(
  options: BoardPacketOptions
): Promise<{ id: string; url: string }> {
  const supabase = createAdminClient()

  // Generate data and PDF
  const data = await generateBoardPacketData(options)
  const pdfBytes = await generateBoardPacketPDF(data)

  // Store PDF
  const fileName = `board-packets/${options.organizationId}/${Date.now()}.pdf`
  await supabase.storage.from('documents').upload(fileName, pdfBytes, {
    contentType: 'application/pdf',
  })

  const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(fileName)

  // Save record
  const { data: record, error } = await supabase
    .from('board_reports')
    .insert({
      organization_id: options.organizationId,
      period_type: options.period,
      period_start: data.period.start,
      period_end: data.period.end,
      data,
      pdf_url: publicUrl,
      ai_summary: data.aiSummary,
    })
    .select()
    .single()

  if (error) throw error

  return { id: record.id, url: publicUrl }
}
