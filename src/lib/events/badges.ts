import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import QRCode from 'qrcode'
import { createAdminClient } from '@/lib/supabase/admin'

export type BadgeData = {
  attendeeName: string
  attendeeTitle?: string
  attendeeOrganization?: string
  eventTitle: string
  registrationId: string
  qrCode?: string
  badgeType?: 'attendee' | 'speaker' | 'sponsor' | 'staff' | 'vip'
}

export type BadgeTemplate = {
  width: number
  height: number
  orientation: 'portrait' | 'landscape'
  fields: {
    name: { x: number; y: number; size: number; maxWidth?: number }
    title?: { x: number; y: number; size: number }
    organization?: { x: number; y: number; size: number }
    event?: { x: number; y: number; size: number }
    qr?: { x: number; y: number; size: number }
    badgeType?: { x: number; y: number; size: number }
  }
}

const DEFAULT_TEMPLATE: BadgeTemplate = {
  width: 252, // 3.5 inches at 72 dpi
  height: 324, // 4.5 inches
  orientation: 'portrait',
  fields: {
    name: { x: 126, y: 200, size: 24, maxWidth: 220 },
    title: { x: 126, y: 170, size: 12 },
    organization: { x: 126, y: 150, size: 14 },
    event: { x: 126, y: 50, size: 10 },
    qr: { x: 76, y: 230, size: 100 },
    badgeType: { x: 126, y: 300, size: 18 },
  },
}

export async function generateBadgePDF(badges: BadgeData[], template: BadgeTemplate = DEFAULT_TEMPLATE): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create()
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  // Calculate badges per page (letter size, 2 columns x 2 rows)
  const pageWidth = 612
  const pageHeight = 792
  const badgesPerPage = 4
  const cols = 2
  const marginX = (pageWidth - template.width * cols) / (cols + 1)
  const marginY = (pageHeight - template.height * 2) / 3

  for (let i = 0; i < badges.length; i += badgesPerPage) {
    const page = pdfDoc.addPage([pageWidth, pageHeight])
    
    for (let j = 0; j < badgesPerPage && i + j < badges.length; j++) {
      const badge = badges[i + j]
      const col = j % cols
      const row = Math.floor(j / cols)
      
      const offsetX = marginX + col * (template.width + marginX)
      const offsetY = pageHeight - marginY - (row + 1) * template.height - row * marginY

      // Draw badge border
      page.drawRectangle({
        x: offsetX,
        y: offsetY,
        width: template.width,
        height: template.height,
        borderColor: rgb(0.8, 0.8, 0.8),
        borderWidth: 0.5,
      })

      // Badge type ribbon
      const typeColors: Record<string, { r: number; g: number; b: number }> = {
        attendee: { r: 0.2, g: 0.4, b: 0.8 },
        speaker: { r: 0.8, g: 0.2, b: 0.2 },
        sponsor: { r: 0.8, g: 0.6, b: 0.1 },
        staff: { r: 0.2, g: 0.6, b: 0.2 },
        vip: { r: 0.5, g: 0.2, b: 0.8 },
      }
      const typeColor = typeColors[badge.badgeType || 'attendee']
      
      page.drawRectangle({
        x: offsetX,
        y: offsetY + template.height - 30,
        width: template.width,
        height: 30,
        color: rgb(typeColor.r, typeColor.g, typeColor.b),
      })

      // Badge type text
      const typeText = (badge.badgeType || 'attendee').toUpperCase()
      const typeWidth = helveticaBold.widthOfTextAtSize(typeText, 14)
      page.drawText(typeText, {
        x: offsetX + (template.width - typeWidth) / 2,
        y: offsetY + template.height - 20,
        size: 14,
        font: helveticaBold,
        color: rgb(1, 1, 1),
      })

      // Name
      const nameWidth = helveticaBold.widthOfTextAtSize(badge.attendeeName, template.fields.name.size)
      const nameFontSize = nameWidth > (template.fields.name.maxWidth || 220)
        ? template.fields.name.size * ((template.fields.name.maxWidth || 220) / nameWidth)
        : template.fields.name.size
      const adjustedNameWidth = helveticaBold.widthOfTextAtSize(badge.attendeeName, nameFontSize)
      
      page.drawText(badge.attendeeName, {
        x: offsetX + (template.width - adjustedNameWidth) / 2,
        y: offsetY + template.fields.name.y,
        size: nameFontSize,
        font: helveticaBold,
        color: rgb(0.1, 0.1, 0.1),
      })

      // Title
      if (badge.attendeeTitle && template.fields.title) {
        const titleWidth = helvetica.widthOfTextAtSize(badge.attendeeTitle, template.fields.title.size)
        page.drawText(badge.attendeeTitle, {
          x: offsetX + (template.width - titleWidth) / 2,
          y: offsetY + template.fields.title.y,
          size: template.fields.title.size,
          font: helvetica,
          color: rgb(0.3, 0.3, 0.3),
        })
      }

      // Organization
      if (badge.attendeeOrganization && template.fields.organization) {
        const orgWidth = helveticaBold.widthOfTextAtSize(badge.attendeeOrganization, template.fields.organization.size)
        page.drawText(badge.attendeeOrganization, {
          x: offsetX + (template.width - Math.min(orgWidth, template.width - 20)) / 2,
          y: offsetY + template.fields.organization.y,
          size: template.fields.organization.size,
          font: helveticaBold,
          color: rgb(0.2, 0.2, 0.2),
          maxWidth: template.width - 20,
        })
      }

      // QR Code (check-in code)
      if (template.fields.qr) {
        const qrDataUrl = await QRCode.toDataURL(badge.registrationId, { width: 100, margin: 0 })
        const qrImageBytes = Buffer.from(qrDataUrl.split(',')[1], 'base64')
        const qrImage = await pdfDoc.embedPng(qrImageBytes)
        
        page.drawImage(qrImage, {
          x: offsetX + template.fields.qr.x,
          y: offsetY + template.fields.qr.y,
          width: template.fields.qr.size,
          height: template.fields.qr.size,
        })
      }

      // Event name at bottom
      if (template.fields.event) {
        const eventWidth = helvetica.widthOfTextAtSize(badge.eventTitle, template.fields.event.size)
        page.drawText(badge.eventTitle, {
          x: offsetX + (template.width - eventWidth) / 2,
          y: offsetY + template.fields.event.y,
          size: template.fields.event.size,
          font: helvetica,
          color: rgb(0.5, 0.5, 0.5),
        })
      }
    }
  }

  return await pdfDoc.save()
}

export async function generateEventBadges(eventId: string): Promise<Uint8Array> {
  const supabase = createAdminClient()

  const { data: event } = await supabase
    .from('events')
    .select('title')
    .eq('id', eventId)
    .single()

  const { data: registrations } = await supabase
    .from('event_registrations')
    .select('id, attendee_name, attendee_email, registration_type, member_organizations(name)')
    .eq('event_id', eventId)
    .eq('status', 'confirmed')

  if (!registrations?.length) {
    throw new Error('No confirmed registrations found')
  }

  const badges: BadgeData[] = registrations.map(reg => ({
    attendeeName: reg.attendee_name,
    attendeeOrganization: reg.member_organizations?.name,
    eventTitle: event?.title || 'Event',
    registrationId: reg.id,
    badgeType: reg.registration_type === 'speaker' ? 'speaker' 
      : reg.registration_type === 'sponsor' ? 'sponsor' 
      : 'attendee',
  }))

  return generateBadgePDF(badges)
}
