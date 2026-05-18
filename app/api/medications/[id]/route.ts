import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit';
import { z } from 'zod';

const DiscontinueSchema = z.object({
  reason: z.string().max(200).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  let payload;
  try {
    payload = DiscontinueSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  const { data: med } = await supabase
    .from('medications')
    .select('id, organization_id, patient_id, name, discontinued_at')
    .eq('id', params.id)
    .single();

  if (!med) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (med.discontinued_at) return NextResponse.json({ error: 'Already discontinued' }, { status: 409 });

  const { error } = await supabase
    .from('medications')
    .update({
      discontinued_at: new Date().toISOString(),
      discontinued_reason: payload.reason ?? null,
    })
    .eq('id', params.id);

  if (error) {
    console.error('[medications] discontinue failed', error);
    return NextResponse.json({ error: 'Could not discontinue medication' }, { status: 500 });
  }

  await logAudit({
    organizationId: med.organization_id,
    userId: user.id,
    action: 'update',
    resourceType: 'medication',
    resourceId: med.id,
    patientId: med.patient_id,
    metadata: { event: 'discontinued', reason: payload.reason ?? null, drug: med.name },
  });

  return NextResponse.json({ ok: true });
}
