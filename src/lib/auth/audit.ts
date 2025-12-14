import { createAdminClient } from '@/lib/supabase/admin'

type AuditAction = 
  | 'create' | 'update' | 'delete' 
  | 'login' | 'logout'
  | 'export' | 'import'
  | 'payment' | 'refund'

type AuditEntry = {
  organizationId: string
  userId: string
  action: AuditAction
  entityType: string
  entityId?: string
  changes?: Record<string, any>
  metadata?: Record<string, any>
}

/**
 * Log an audit entry for compliance and debugging
 */
export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    const supabase = createAdminClient()
    
    await supabase.from('audit_logs').insert({
      organization_id: entry.organizationId,
      user_id: entry.userId,
      action: entry.action,
      entity_type: entry.entityType,
      entity_id: entry.entityId,
      changes: entry.changes,
      metadata: entry.metadata,
    })
  } catch (err) {
    // Don't fail the main operation if audit logging fails
    console.error('[Audit] Failed to log:', err)
  }
}

/**
 * Middleware-style audit wrapper for API handlers
 */
export function withAudit<T>(
  handler: (ctx: any, body?: any) => Promise<T>,
  action: AuditAction,
  entityType: string
) {
  return async (ctx: any, body?: any): Promise<T> => {
    const result = await handler(ctx, body)
    
    // Log after successful operation
    await logAudit({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action,
      entityType,
      entityId: (result as any)?.id,
      changes: body,
    })
    
    return result
  }
}
