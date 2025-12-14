export type CertificateData = {
  attendeeName: string
  attendeeEmail: string
  eventTitle: string
  creditHours: number
  creditType: string
  completionDate: string
  accreditingBody?: string
  accreditationNumber?: string
  organizationName: string
  certificateId: string
}

export type CertificateTemplate = {
  id: string
  name: string
  backgroundUrl?: string
  fields: FieldConfig[]
}

export type FieldConfig = {
  key: keyof CertificateData | string
  x: number
  y: number
  size: number
  font: 'Helvetica' | 'Helvetica-Bold' | 'Times-Roman' | 'Times-Bold'
  color?: { r: number; g: number; b: number }
  align?: 'left' | 'center' | 'right'
  maxWidth?: number
}
