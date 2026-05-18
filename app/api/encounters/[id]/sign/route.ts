import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit';
import { verifySignPin } from '@/lib/clinical/sign-pin';
import { z } from 'zod';

const SignSchema = z.object({
  pin: z.string().regex(/^\d{4,6}$/),
});

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  let payload;
  try {
    payload = SignSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: 'Invalid PIN format' }, { status: 400 });
  }

  const admin = createServiceClient();
  const { data: userRow } = await admin
    .from('users')
    .select('id, sign_pin_hash, organization_id')
    .eq('id', user.id)
    .single();

  if (!userRow) return NextResponse.json({ error: 'No profile' }, { status: 403 });

  if (!userRow.sign_pin_hash) {
    return NextResponse.json({ error: 'no_pin_set', message: 'Set a sign PIN in Settings before signing encounters.' }, { status: 412 });
  }

  const ok = await verifySignPin(payload.pin, userRow.sign_pin_hash);
  if (!ok) {
    await logAudit({
      organizationId: userRow.organization_id,
      userId: user.id,
      action: 'failed_login',
      resourceType: 'encounter_sign',
      resourceId: params.id,
      metadata: { reason: 'invalid_pin' },
    });
    return NextResponse.json({ error: 'Invalid PIN' }, { status: 403 });
  }

  const { data: enc } = await supabase
    .from('encounters')
    .select('id, organization_id, patient_id, provider_id, status, signed_at, locked_at, assessment, plan, chief_complaint')
    .eq('id', params.id)
    .single();

  if (!enc) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (enc.signed_at || enc.locked_at) {
    return NextResponse.json({ error: 'Already signed' }, { status: 409 });
  }

  if (enc.provider_id !== user.id) {
    return NextResponse.json({ error: 'Only the assigned provider can sign this encounter' }, { status: 403 });
  }

  const assessmentEmpty = !enc.assessment || !(enc.assessment as any)?.sections?.some((s: any) => s.content?.trim());
  const planEmpty = !enc.plan || !(enc.plan as any)?.sections?.some((s: any) => s.content?.trim());
  if (assessmentEmpty && planEmpty) {
    return NextResponse.json({ error: 'Cannot sign empty encounter. Add assessment or plan content first.' }, { status: 422 });
  }

  const now = new Date().toISOString();
  const { error: updateErr } = await supabase
    .from('encounters')
    .update({
      status: 'signed',
      signed_at: now,
      signed_by: user.id,
      locked_at: now,
      ended_at: now,
    })
    .eq('id', params.id);

  if (updateErr) {
    console.error('[encounters] sign failed', updateErr);
    return NextResponse.json({ error: 'Could not sign encounter' }, { status: 500 });
  }

  await logAudit({
    organizationId: enc.organization_id,
    userId: user.id,
    action: 'update',
    resourceType: 'encounter',
    resourceId: enc.id,
    patientId: enc.patient_id,
    metadata: { event: 'signed', signed_at: now },
  });

  return NextResponse.json({ ok: true, signed_at: now });
}
