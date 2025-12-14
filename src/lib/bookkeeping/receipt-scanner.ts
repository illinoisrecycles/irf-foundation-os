import OpenAI from 'openai'
import { createAdminClient } from '@/lib/supabase/admin'

// Lazy-loaded OpenAI client
let openaiClient: OpenAI | null = null
function getOpenAI(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' })
  }
  return openaiClient
}

// ============================================================================
// AI RECEIPT/INVOICE SCANNER
// Uses GPT-4 Vision to extract data from receipts and invoices
// ============================================================================

export type ExtractedReceiptData = {
  vendor: {
    name: string
    address?: string
    phone?: string
    taxId?: string
  }
  date: string
  invoiceNumber?: string
  dueDate?: string
  lineItems: {
    description: string
    quantity: number
    unitPrice: number
    amount: number
    category?: string
  }[]
  subtotal: number
  tax: number
  total: number
  paymentMethod?: string
  currency: string
  confidence: number
}

/**
 * Scan receipt/invoice image and extract structured data
 */
export async function scanReceipt(
  organizationId: string,
  imageUrl: string,
  scanId: string
): Promise<ExtractedReceiptData> {
  const supabase = createAdminClient()

  // Update status
  await supabase
    .from('receipt_scans')
    .update({ status: 'processing', processing_started_at: new Date().toISOString() })
    .eq('id', scanId)

  try {
    const response = await getOpenAI().chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Extract all data from this receipt/invoice image. Return JSON only:
{
  "vendor": {
    "name": "Vendor/Store name",
    "address": "Full address if visible",
    "phone": "Phone number if visible",
    "taxId": "Tax ID/EIN if visible"
  },
  "date": "YYYY-MM-DD",
  "invoiceNumber": "Invoice/receipt number if visible",
  "dueDate": "YYYY-MM-DD if this is an invoice with due date",
  "lineItems": [
    {
      "description": "Item description",
      "quantity": 1,
      "unitPrice": 10.00,
      "amount": 10.00,
      "category": "suggested expense category"
    }
  ],
  "subtotal": 100.00,
  "tax": 8.25,
  "total": 108.25,
  "paymentMethod": "credit_card/cash/check if visible",
  "currency": "USD",
  "confidence": 0.0-1.0 overall extraction confidence
}

Be precise with numbers. If something is unclear, make your best estimate and lower confidence.`
            },
            {
              type: 'image_url',
              image_url: { url: imageUrl }
            }
          ]
        }
      ],
      response_format: { type: 'json_object' },
      max_tokens: 2000,
    })

    const extracted = JSON.parse(response.choices[0].message.content || '{}')

    // Update scan record
    await supabase
      .from('receipt_scans')
      .update({
        status: 'completed',
        extracted_data: extracted,
        confidence_score: extracted.confidence || 0.5,
        processing_completed_at: new Date().toISOString(),
      })
      .eq('id', scanId)

    return extracted
  } catch (err: any) {
    await supabase
      .from('receipt_scans')
      .update({
        status: 'failed',
        error_message: err.message,
        processing_completed_at: new Date().toISOString(),
      })
      .eq('id', scanId)

    throw err
  }
}

/**
 * Create bill from scanned receipt data
 */
export async function createBillFromScan(
  organizationId: string,
  scanId: string
): Promise<string> {
  const supabase = createAdminClient()

  // Get scan data
  const { data: scan } = await supabase
    .from('receipt_scans')
    .select('*')
    .eq('id', scanId)
    .single()

  if (!scan?.extracted_data) {
    throw new Error('No extracted data found')
  }

  const data = scan.extracted_data as ExtractedReceiptData

  // Find or create vendor
  let vendorId: string
  const { data: existingVendor } = await supabase
    .from('vendors')
    .select('id')
    .eq('organization_id', organizationId)
    .ilike('name', data.vendor.name)
    .single()

  if (existingVendor) {
    vendorId = existingVendor.id
  } else {
    const { data: newVendor } = await supabase
      .from('vendors')
      .insert({
        organization_id: organizationId,
        name: data.vendor.name,
        address_line1: data.vendor.address,
        phone: data.vendor.phone,
        tax_id: data.vendor.taxId,
      })
      .select('id')
      .single()
    vendorId = newVendor!.id
  }

  // Get default expense account
  const { data: expenseAccount } = await supabase
    .from('chart_of_accounts')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('account_type', 'expense')
    .limit(1)
    .single()

  // Create bill
  const { data: bill } = await supabase
    .from('bills')
    .insert({
      organization_id: organizationId,
      vendor_id: vendorId,
      bill_number: data.invoiceNumber,
      bill_date: data.date,
      due_date: data.dueDate || data.date,
      subtotal_cents: Math.round(data.subtotal * 100),
      tax_cents: Math.round(data.tax * 100),
      total_cents: Math.round(data.total * 100),
      balance_cents: Math.round(data.total * 100),
      status: 'pending',
      attachments: [{ url: scan.file_url, name: scan.file_name }],
      ai_extracted: true,
      ai_extracted_data: data,
    })
    .select('id')
    .single()

  // Create line items
  for (const item of data.lineItems) {
    await supabase.from('bill_lines').insert({
      bill_id: bill!.id,
      description: item.description,
      quantity: item.quantity,
      unit_price_cents: Math.round(item.unitPrice * 100),
      amount_cents: Math.round(item.amount * 100),
      account_id: expenseAccount!.id,
    })
  }

  // Update scan with bill reference
  await supabase
    .from('receipt_scans')
    .update({ bill_id: bill!.id })
    .eq('id', scanId)

  return bill!.id
}

/**
 * Process uploaded receipt (upload -> scan -> create bill)
 */
export async function processReceiptUpload(
  organizationId: string,
  userId: string,
  file: { url: string; name: string; type: string }
): Promise<{ scanId: string; billId?: string }> {
  const supabase = createAdminClient()

  // Create scan record
  const { data: scan } = await supabase
    .from('receipt_scans')
    .insert({
      organization_id: organizationId,
      file_url: file.url,
      file_name: file.name,
      file_type: file.type,
      uploaded_by: userId,
      status: 'pending',
    })
    .select('id')
    .single()

  // Scan receipt
  await scanReceipt(organizationId, file.url, scan!.id)

  // Auto-create bill
  const billId = await createBillFromScan(organizationId, scan!.id)

  return { scanId: scan!.id, billId }
}
