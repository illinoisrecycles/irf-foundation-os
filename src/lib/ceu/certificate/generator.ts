import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import { CertificateData, CertificateTemplate, FieldConfig } from './types'

export async function generateCertificatePDF(
  data: CertificateData, 
  template: CertificateTemplate
): Promise<Uint8Array> {
  // Create a new PDF document (landscape letter)
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([792, 612]) // Letter landscape
  const { width, height } = page.getSize()

  // Embed fonts
  const fonts: Record<string, any> = {
    'Helvetica': await pdfDoc.embedFont(StandardFonts.Helvetica),
    'Helvetica-Bold': await pdfDoc.embedFont(StandardFonts.HelveticaBold),
    'Times-Roman': await pdfDoc.embedFont(StandardFonts.TimesRoman),
    'Times-Bold': await pdfDoc.embedFont(StandardFonts.TimesRomanBold),
  }

  // Draw decorative border
  const borderColor = rgb(0.2, 0.4, 0.6)
  page.drawRectangle({
    x: 20, y: 20,
    width: width - 40,
    height: height - 40,
    borderColor,
    borderWidth: 3,
  })
  page.drawRectangle({
    x: 30, y: 30,
    width: width - 60,
    height: height - 60,
    borderColor,
    borderWidth: 1,
  })

  // Prepare computed text values
  const textValues: Record<string, string> = {
    header: 'Certificate of Completion',
    attendeeName: data.attendeeName,
    completion_text: 'has successfully completed',
    eventTitle: data.eventTitle,
    credits_text: `Earning ${data.creditHours} ${data.creditType} Credits`,
    completionDate: `Completed on ${data.completionDate}`,
    accreditationNumber: data.accreditationNumber 
      ? `Accreditation #: ${data.accreditationNumber} | ${data.accreditingBody || ''}`
      : '',
    organizationName: data.organizationName,
    certificateId: `Certificate ID: ${data.certificateId}`,
  }

  // Draw each field
  for (const field of template.fields) {
    const text = textValues[field.key] || data[field.key as keyof CertificateData] || ''
    if (!text) continue

    const font = fonts[field.font] || fonts['Helvetica']
    const color = field.color 
      ? rgb(field.color.r, field.color.g, field.color.b)
      : rgb(0, 0, 0)

    // Calculate X position based on alignment
    let x = field.x
    const textWidth = font.widthOfTextAtSize(String(text), field.size)

    if (field.align === 'center') {
      x = (width - textWidth) / 2
    } else if (field.align === 'right') {
      x = width - textWidth - (field.x || 50)
    }

    // Calculate Y position (convert from top-down to bottom-up)
    const y = height - field.y

    page.drawText(String(text), {
      x,
      y,
      size: field.size,
      font,
      color,
      maxWidth: field.maxWidth,
    })
  }

  return await pdfDoc.save()
}
