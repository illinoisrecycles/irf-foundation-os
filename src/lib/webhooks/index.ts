import crypto from 'crypto'

// ============================================================================
// WEBHOOK TYPES
// ============================================================================
export type WebhookEventType =
  | 'member.created'
  | 'member.updated'
  | 'member.expired'
  | 'member.renewed'
  | 'donation.created'
  | 'donation.refunded'
  | 'payment.succeeded'
  | 'payment.failed'
  | 'event.created'
  | 'event.registration.created'
  | 'event.registration.cancelled'
  | 'grant.application.submitted'
  | 'grant.application.approved'
  | 'grant.application.denied'

export type WebhookDeliveryResult = {
  success: boolean
  status?: number
  duration_ms: number
  error?: string
}

// ============================================================================
// SIGNATURE GENERATION
// ============================================================================
export function generateWebhookSignature(payload: string, secret: string): string {
  const timestamp = Math.floor(Date.now() / 1000)
  const signaturePayload = `${timestamp}.${payload}`
  const signature = crypto
    .createHmac('sha256', secret)
    .update(signaturePayload)
    .digest('hex')
  return `t=${timestamp},v1=${signature}`
}

export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string,
  tolerance: number = 300
): boolean {
  try {
    const parts = signature.split(',')
    const timestamp = parseInt(parts.find(p => p.startsWith('t='))?.slice(2) || '0')
    const expectedSig = parts.find(p => p.startsWith('v1='))?.slice(3)
    if (!expectedSig) return false

    const age = Math.floor(Date.now() / 1000) - timestamp
    if (age > tolerance) return false

    const signaturePayload = `${timestamp}.${payload}`
    const computed = crypto.createHmac('sha256', secret).update(signaturePayload).digest('hex')

    return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(expectedSig))
  } catch {
    return false
  }
}

// ============================================================================
// WEBHOOK DELIVERY
// ============================================================================
export async function deliverWebhook(
  url: string,
  eventType: WebhookEventType,
  payload: Record<string, any>,
  secret?: string
): Promise<WebhookDeliveryResult> {
  const startTime = Date.now()
  const body = JSON.stringify({
    event: eventType,
    timestamp: new Date().toISOString(),
    data: payload,
  })

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'FoundationOS-Webhook/1.0',
    'X-Webhook-Event': eventType,
  }

  if (secret) {
    headers['X-Webhook-Signature'] = generateWebhookSignature(body, secret)
  }

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body,
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    return {
      success: response.ok,
      status: response.status,
      duration_ms: Date.now() - startTime,
    }
  } catch (err: any) {
    return {
      success: false,
      duration_ms: Date.now() - startTime,
      error: err.message || 'Unknown error',
    }
  }
}

// ============================================================================
// BULK WEBHOOK TRIGGER
// ============================================================================
export async function triggerWebhooks(
  supabase: any,
  orgId: string,
  eventType: WebhookEventType,
  payload: Record<string, any>
): Promise<{ delivered: number; failed: number }> {
  const { data: webhooks, error } = await supabase
    .from('webhooks')
    .select('id, url, secret')
    .eq('organization_id', orgId)
    .eq('is_active', true)
    .contains('event_types', [eventType])

  if (error || !webhooks?.length) {
    return { delivered: 0, failed: 0 }
  }

  let delivered = 0
  let failed = 0

  for (const webhook of webhooks) {
    const result = await deliverWebhook(webhook.url, eventType, payload, webhook.secret)

    await supabase.from('webhook_logs').insert({
      webhook_id: webhook.id,
      event_type: eventType,
      payload,
      response_status: result.status,
      response_body: result.error,
      duration_ms: result.duration_ms,
    })

    if (result.success) {
      delivered++
      await supabase
        .from('webhooks')
        .update({ last_triggered_at: new Date().toISOString(), failure_count: 0 })
        .eq('id', webhook.id)
    } else {
      failed++
      // Increment failure count
      const { data: current } = await supabase
        .from('webhooks')
        .select('failure_count')
        .eq('id', webhook.id)
        .single()

      const newCount = (current?.failure_count || 0) + 1
      await supabase
        .from('webhooks')
        .update({ 
          failure_count: newCount,
          is_active: newCount < 10 // Disable after 10 failures
        })
        .eq('id', webhook.id)
    }
  }

  return { delivered, failed }
}
