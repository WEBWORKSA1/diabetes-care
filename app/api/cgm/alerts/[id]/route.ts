import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit';
import { z } from 'zod';

const PatchSchema = z.object({
  acknowledged: z.boolean().optional(),
  resolved: z.boolean().optional(),
  resolution_note: z.string().max(500).optional(),
});

/**
 * PATCH /api/cgm/alerts/[id]
 * Acknowledge or resolve an alert.
 */
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  let body;
  try {
    body = PatchSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  const { data: alert } = await supabase
    .from('cgm_alerts')
    .select('id, organization_id, patient_id, alert_type, severity')
    .eq('id', params.id)
    .single();

  if (!alert) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const update: any = {};
  const now = new Date().toISOString();

  if (body.acknowledged) {
    update.acknowledged_at = now;
    update.acknowledged_by = user.id;
  }
  if (body.resolved) {
    update.resolved_at = now;
    update.resolved_by = user.id;
    if (body.resolution_note) update.resolution_note = body.resolution_note;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No changes' }, { status: 400 });
  }

  const { error } = await supabase.from('cgm_alerts').update(update).eq('id', alert.id);
  if (error) return NextResponse.json({ error: 'Update failed' }, { status: 500 });

  await logAudit({
    organizationId: alert.organization_id,
    userId: user.id,
    action: 'update',
    resourceType: 'cgm_alert',
    resourceId: alert.id,
    patientId: alert.patient_id,
    metadata: { event: body.resolved ? 'resolved' : 'acknowledged', alert_type: alert.alert_type },
  });

  return NextResponse.json({ ok: true });
}
