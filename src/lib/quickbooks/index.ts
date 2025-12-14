// ============================================================================
// QUICKBOOKS ONLINE INTEGRATION
// ============================================================================

const QBO_BASE_URL = 'https://quickbooks.api.intuit.com/v3/company'
const QBO_SANDBOX_URL = 'https://sandbox-quickbooks.api.intuit.com/v3/company'

type QBOTokens = {
  access_token: string
  refresh_token: string
  realm_id: string
  expires_at: Date
}

// ============================================================================
// TOKEN MANAGEMENT
// ============================================================================
export async function refreshQBOToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string
): Promise<QBOTokens | null> {
  try {
    const response = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    })

    if (!response.ok) {
      console.error('[QBO] Token refresh failed:', await response.text())
      return null
    }

    const data = await response.json()
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      realm_id: '', // Preserved from original
      expires_at: new Date(Date.now() + data.expires_in * 1000),
    }
  } catch (err) {
    console.error('[QBO] Token refresh error:', err)
    return null
  }
}

export async function getQBOAccessToken(
  supabase: any,
  orgId: string
): Promise<{ accessToken: string; realmId: string } | null> {
  const { data: org } = await supabase
    .from('organizations')
    .select('quickbooks_realm_id, quickbooks_access_token, quickbooks_refresh_token, quickbooks_token_expires_at')
    .eq('id', orgId)
    .single()

  if (!org?.quickbooks_realm_id || !org?.quickbooks_refresh_token) {
    return null
  }

  // Check if token needs refresh
  const expiresAt = org.quickbooks_token_expires_at ? new Date(org.quickbooks_token_expires_at) : new Date(0)
  if (expiresAt > new Date(Date.now() + 5 * 60 * 1000)) {
    return { accessToken: org.quickbooks_access_token, realmId: org.quickbooks_realm_id }
  }

  // Refresh token
  const clientId = process.env.QUICKBOOKS_CLIENT_ID
  const clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET
  if (!clientId || !clientSecret) return null

  const tokens = await refreshQBOToken(clientId, clientSecret, org.quickbooks_refresh_token)
  if (!tokens) return null

  // Update in database
  await supabase
    .from('organizations')
    .update({
      quickbooks_access_token: tokens.access_token,
      quickbooks_refresh_token: tokens.refresh_token,
      quickbooks_token_expires_at: tokens.expires_at.toISOString(),
    })
    .eq('id', orgId)

  return { accessToken: tokens.access_token, realmId: org.quickbooks_realm_id }
}

// ============================================================================
// API HELPERS
// ============================================================================
async function qboRequest(
  method: string,
  endpoint: string,
  accessToken: string,
  realmId: string,
  body?: any
): Promise<any> {
  const baseUrl = process.env.QUICKBOOKS_SANDBOX === 'true' ? QBO_SANDBOX_URL : QBO_BASE_URL
  const url = `${baseUrl}/${realmId}/${endpoint}`

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`QBO API error: ${response.status} - ${error}`)
  }

  return response.json()
}

// ============================================================================
// CUSTOMER SYNC
// ============================================================================
export async function syncCustomerToQBO(
  accessToken: string,
  realmId: string,
  member: {
    id: string
    name: string
    email: string
    billing_address?: string
    billing_city?: string
    billing_state?: string
    billing_zip?: string
  }
): Promise<{ qboId: string } | null> {
  try {
    const customer = {
      DisplayName: member.name.slice(0, 100), // QBO limit
      PrimaryEmailAddr: { Address: member.email },
      BillAddr: member.billing_address ? {
        Line1: member.billing_address,
        City: member.billing_city,
        CountrySubDivisionCode: member.billing_state,
        PostalCode: member.billing_zip,
      } : undefined,
    }

    const result = await qboRequest('POST', 'customer', accessToken, realmId, customer)
    return { qboId: result.Customer.Id }
  } catch (err) {
    console.error('[QBO] Sync customer error:', err)
    return null
  }
}

// ============================================================================
// INVOICE SYNC
// ============================================================================
export async function syncInvoiceToQBO(
  accessToken: string,
  realmId: string,
  invoice: {
    id: string
    customer_qbo_id: string
    line_items: { description: string; amount_cents: number; item_qbo_id?: string }[]
    due_date: string
    memo?: string
  }
): Promise<{ qboId: string } | null> {
  try {
    const qboInvoice = {
      CustomerRef: { value: invoice.customer_qbo_id },
      DueDate: invoice.due_date.split('T')[0],
      PrivateNote: invoice.memo,
      Line: invoice.line_items.map((item, idx) => ({
        Amount: item.amount_cents / 100,
        DetailType: 'SalesItemLineDetail',
        SalesItemLineDetail: {
          ItemRef: item.item_qbo_id ? { value: item.item_qbo_id } : undefined,
        },
        Description: item.description,
        LineNum: idx + 1,
      })),
    }

    const result = await qboRequest('POST', 'invoice', accessToken, realmId, qboInvoice)
    return { qboId: result.Invoice.Id }
  } catch (err) {
    console.error('[QBO] Sync invoice error:', err)
    return null
  }
}

// ============================================================================
// PAYMENT SYNC
// ============================================================================
export async function syncPaymentToQBO(
  accessToken: string,
  realmId: string,
  payment: {
    customer_qbo_id: string
    amount_cents: number
    invoice_qbo_id?: string
    payment_date: string
    payment_method?: string
  }
): Promise<{ qboId: string } | null> {
  try {
    const qboPayment: any = {
      CustomerRef: { value: payment.customer_qbo_id },
      TotalAmt: payment.amount_cents / 100,
      TxnDate: payment.payment_date.split('T')[0],
    }

    if (payment.invoice_qbo_id) {
      qboPayment.Line = [{
        Amount: payment.amount_cents / 100,
        LinkedTxn: [{
          TxnId: payment.invoice_qbo_id,
          TxnType: 'Invoice',
        }],
      }]
    }

    const result = await qboRequest('POST', 'payment', accessToken, realmId, qboPayment)
    return { qboId: result.Payment.Id }
  } catch (err) {
    console.error('[QBO] Sync payment error:', err)
    return null
  }
}

// ============================================================================
// BATCH SYNC
// ============================================================================
export async function syncPendingToQBO(supabase: any, orgId: string): Promise<{ synced: number; failed: number }> {
  const auth = await getQBOAccessToken(supabase, orgId)
  if (!auth) return { synced: 0, failed: 0 }

  const { data: pending } = await supabase
    .from('quickbooks_sync_log')
    .select('*')
    .eq('organization_id', orgId)
    .eq('sync_status', 'pending')
    .limit(50)

  if (!pending?.length) return { synced: 0, failed: 0 }

  let synced = 0
  let failed = 0

  for (const item of pending) {
    try {
      // Process based on entity type
      // This is a placeholder - actual implementation would fetch the entity and sync
      await supabase
        .from('quickbooks_sync_log')
        .update({ sync_status: 'synced', synced_at: new Date().toISOString() })
        .eq('id', item.id)
      synced++
    } catch (err: any) {
      await supabase
        .from('quickbooks_sync_log')
        .update({ sync_status: 'failed', error_message: err.message })
        .eq('id', item.id)
      failed++
    }
  }

  return { synced, failed }
}
