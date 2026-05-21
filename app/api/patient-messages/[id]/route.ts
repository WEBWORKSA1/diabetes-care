import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit';
import { z } from 'zod';

const PatchSchema = z.object({
  acknowledged: z.boolean().optional(),
  resolved: z.boolean().optional(),
  resolution_note: z.string().max(1000).optional(),
  triage_flag: z.boolean().optional(),
});

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { data, error } = await supabase
    .from('patient_messages')
    .select(`
      *,
      patients(id, first_name, last_name, mrn, phone_mobile),
      ack_by:users!patient_messages_acknowledged_by_fkey(full_name),
      res_by:users!patient_messages_resolved_by_fkey(full_name)
    `)
    .eq('id', params.id)
    .single();

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ message: data });
}

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
  } catch (err) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from('patient_messages')
    .select('id, organization_id, patient_id')
    .eq('id', params.id)
    .single();
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

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
  if (body.triage_flag !== undefined) update.triage_flag = body.triage_flag;

  const { error } = await supabase.from('patient_messages').update(update).eq('id', existing.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({
    organizationId: existing.organization_id,
    userId: user.id,
    action: 'update',
    resourceType: 'patient_message',
    resourceId: existing.id,
    patientId: existing.patient_id,
  });

  return NextResponse.json({ ok: true });
}
