import { createAdminClient } from '@/lib/supabase/admin'

export async function uploadCertificate(
  pdfBytes: Uint8Array,
  orgId: string,
  creditId: string
): Promise<{ publicUrl: string; path: string }> {
  const supabase = createAdminClient()
  const path = `certificates/${orgId}/${creditId}.pdf`

  const { error } = await supabase.storage
    .from('documents')
    .upload(path, pdfBytes, {
      contentType: 'application/pdf',
      upsert: true,
    })

  if (error && error.message !== 'The resource already exists') {
    throw new Error(`Upload failed: ${error.message}`)
  }

  const { data: { publicUrl } } = supabase.storage
    .from('documents')
    .getPublicUrl(path)

  return { publicUrl, path }
}
