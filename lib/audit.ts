import { createServiceClient } from '@/lib/supabase/server';
import { headers } from 'next/headers';

export type AuditAction =
  | 'create'
  | 'read'
  | 'update'
  | 'soft_delete'
  | 'restore'
  | 'export'
  | 'login'
  | 'logout'
  | 'failed_login'
  | 'permission_change';

export interface AuditEvent {
  organizationId: string;
  userId: string | null;
  action: AuditAction;
  resourceType: string;
  resourceId?: string | null;
  patientId?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Log an auditable event. HIPAA-required.
 * Failures are logged but never throw — audit failure must not break the request.
 */
export async function logAudit(event: AuditEvent): Promise<void> {
  try {
    const h = headers();
    const ip = h.get('x-forwarded-for')?.split(',')[0].trim() ?? null;
    const userAgent = h.get('user-agent') ?? null;

    const supabase = createServiceClient();
    const { error } = await supabase.from('audit_logs').insert({
      organization_id: event.organizationId,
      user_id: event.userId,
      action: event.action,
      resource_type: event.resourceType,
      resource_id: event.resourceId ?? null,
      patient_id: event.patientId ?? null,
      metadata: event.metadata ?? {},
      ip_address: ip,
      user_agent: userAgent,
    });

    if (error) {
      console.error('[audit] write failed', error, event);
    }
  } catch (err) {
    console.error('[audit] exception', err, event);
  }
}
