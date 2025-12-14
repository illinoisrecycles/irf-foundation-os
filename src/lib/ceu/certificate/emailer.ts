import { sendEmail } from '@/lib/email'
import { CertificateData } from './types'

export async function sendCertificateEmail(
  data: CertificateData & { certificateUrl: string }
): Promise<void> {
  await sendEmail({
    to: data.attendeeEmail,
    subject: `Your ${data.creditType} Certificate is Ready`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #1a365d;">Congratulations, ${data.attendeeName}!</h1>
        
        <p>You have successfully earned continuing education credits.</p>
        
        <div style="background: #f7fafc; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <p><strong>Event:</strong> ${data.eventTitle}</p>
          <p><strong>Credits Earned:</strong> ${data.creditHours} ${data.creditType}</p>
          <p><strong>Completion Date:</strong> ${data.completionDate}</p>
          ${data.accreditingBody ? `<p><strong>Accrediting Body:</strong> ${data.accreditingBody}</p>` : ''}
        </div>
        
        <a href="${data.certificateUrl}" style="
          display: inline-block;
          background: #10b981;
          color: white;
          padding: 14px 28px;
          border-radius: 8px;
          text-decoration: none;
          font-weight: bold;
        ">Download Your Certificate</a>
        
        <p style="margin-top: 30px; color: #718096; font-size: 14px;">
          This certificate has been automatically generated and added to your transcript.
        </p>
        
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
        
        <p style="color: #a0aec0; font-size: 12px;">
          Certificate ID: ${data.certificateId}<br>
          ${data.organizationName}
        </p>
      </div>
    `,
  })
}
