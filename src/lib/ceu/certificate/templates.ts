import { CertificateTemplate } from './types'

export const defaultTemplate: CertificateTemplate = {
  id: 'default',
  name: 'Standard CEU Certificate',
  fields: [
    { 
      key: 'header', 
      x: 0, y: 100, 
      size: 28, 
      font: 'Helvetica-Bold', 
      align: 'center',
      color: { r: 0.2, g: 0.4, b: 0.6 }
    },
    { 
      key: 'attendeeName', 
      x: 0, y: 200, 
      size: 32, 
      font: 'Helvetica-Bold', 
      align: 'center',
      color: { r: 0.1, g: 0.1, b: 0.3 }
    },
    { 
      key: 'completion_text', 
      x: 0, y: 260, 
      size: 16, 
      font: 'Helvetica', 
      align: 'center' 
    },
    { 
      key: 'eventTitle', 
      x: 0, y: 310, 
      size: 20, 
      font: 'Helvetica-Bold', 
      align: 'center',
      color: { r: 0, g: 0.4, b: 0.2 },
      maxWidth: 500
    },
    { 
      key: 'credits_text', 
      x: 0, y: 370, 
      size: 18, 
      font: 'Helvetica-Bold', 
      align: 'center' 
    },
    { 
      key: 'completionDate', 
      x: 0, y: 420, 
      size: 14, 
      font: 'Helvetica', 
      align: 'center' 
    },
    { 
      key: 'accreditationNumber', 
      x: 0, y: 460, 
      size: 12, 
      font: 'Helvetica', 
      align: 'center',
      color: { r: 0.4, g: 0.4, b: 0.4 }
    },
    { 
      key: 'organizationName', 
      x: 0, y: 520, 
      size: 14, 
      font: 'Helvetica', 
      align: 'center' 
    },
    { 
      key: 'certificateId', 
      x: 50, y: 560, 
      size: 10, 
      font: 'Helvetica', 
      align: 'left',
      color: { r: 0.5, g: 0.5, b: 0.5 }
    },
  ],
}

export const professionalTemplate: CertificateTemplate = {
  id: 'professional',
  name: 'Professional Certificate',
  fields: [
    ...defaultTemplate.fields,
  ],
}

export function getTemplate(templateId: string = 'default'): CertificateTemplate {
  switch (templateId) {
    case 'professional':
      return professionalTemplate
    default:
      return defaultTemplate
  }
}
