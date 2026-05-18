import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { syncConnection } from '@/lib/cgm/sync-worker';
import { logAudit } from '@/lib/audit';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * POST /api/cgm/connections/[id]/sync
 * Manually trigger a sync for a single connection (owned by the user's org).
 */
export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  // RLS will scope to user's org
  const { data: conn } = await supabase
    .from('cgm_connections')
    .select('id, organization_id, patient_id')
    .eq('id', params.id)
    .is('deleted_at', null)
    .single();

  if (!conn) return NextResponse.json({ error: 'Connection not found' }, { status: 404 });

  const result = await syncConnection({
    connectionId: conn.id,
    triggeredBy: 'manual',
  });

  await logAudit({
    organizationId: conn.organization_id,
    userId: user.id,
    action: 'update',
    resourceType: 'cgm_connection',
    resourceId: conn.id,
    patientId: conn.patient_id,
    metadata: { event: 'manual_sync', ...result },
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  }
  return NextResponse.json(result);
}

/**
 * DELETE /api/cgm/connections/[id]
 * Soft-delete: mark inactive + deleted_at. Tokens stay encrypted in DB until purge.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { data: conn } = await supabase
    .from('cgm_connections')
    .select('id, organization_id, patient_id')
    .eq('id', params.id)
    .is('deleted_at', null)
    .single();

  if (!conn) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { error } = await supabase
    .from('cgm_connections')
    .update({ is_active: false, deleted_at: new Date().toISOString() })
    .eq('id', conn.id);

  if (error) return NextResponse.json({ error: 'Could not disconnect' }, { status: 500 });

  await logAudit({
    organizationId: conn.organization_id,
    userId: user.id,
    action: 'soft_delete',
    resourceType: 'cgm_connection',
    resourceId: conn.id,
    patientId: conn.patient_id,
  });

  return NextResponse.json({ ok: true });
}
