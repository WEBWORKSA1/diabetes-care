import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { syncConnection } from '@/lib/cgm/sync-engine';
import { logAudit } from '@/lib/audit';
import { z } from 'zod';

const SyncSchema = z.object({
  patient_id: z.string().uuid(),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  let payload;
  try {
    payload = SyncSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  const { data: patient } = await supabase
    .from('patients')
    .select('id, organization_id')
    .eq('id', payload.patient_id)
    .single();
  if (!patient) return NextResponse.json({ error: 'Patient not accessible' }, { status: 404 });

  const { data: conn } = await supabase
    .from('cgm_connections')
    .select('id')
    .eq('patient_id', payload.patient_id)
    .eq('is_active', true)
    .is('deleted_at', null)
    .maybeSingle();

  if (!conn) return NextResponse.json({ error: 'No active CGM connection for this patient' }, { status: 404 });

  const result = await syncConnection(conn.id);

  await logAudit({
    organizationId: patient.organization_id,
    userId: user.id,
    action: 'update',
    resourceType: 'cgm_sync_manual',
    resourceId: conn.id,
    patientId: payload.patient_id,
    metadata: { ...result },
  });

  if (result.error) return NextResponse.json({ error: result.error, ...result }, { status: 500 });
  return NextResponse.json(result);
}
