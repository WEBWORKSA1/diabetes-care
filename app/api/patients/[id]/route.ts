import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit';
import { z } from 'zod';

const optStr = (max = 200) => z.string().max(max).optional().nullable().or(z.literal('').transform(() => null));
const optDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable().or(z.literal('').transform(() => null));

const PatchSchema = z.object({
  first_name: z.string().min(1).max(100).optional(),
  last_name: z.string().min(1).max(100).optional(),
  date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  sex_at_birth: z.enum(['male', 'female', 'intersex', 'unknown']).optional(),
  diabetes_type: z.enum(['type_1', 'type_2', 'gestational', 'prediabetes', 'mody', 'lada', 'other']).optional(),
  diagnosis_date: optDate,
  email: optStr(200),
  phone: optStr(30),
  phone_mobile: optStr(30),
  sms_consent: z.boolean().optional(),
  address_line1: optStr(200),
  address_line2: optStr(200),
  city: optStr(100),
  state: optStr(50),
  postal_code: optStr(20),
  race: optStr(50),
  ethnicity: optStr(50),
  preferred_language: optStr(20),
  emergency_contact_name: optStr(150),
  emergency_contact_relationship: optStr(50),
  emergency_contact_phone: optStr(30),
  insurance_carrier: optStr(150),
  insurance_member_id: optStr(100),
  insurance_group_number: optStr(100),
  primary_provider_id: z.string().uuid().nullable().optional(),
});

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { data, error } = await supabase
    .from('patients')
    .select('*')
    .eq('id', params.id)
    .is('deleted_at', null)
    .single();

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ patient: data });
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
    return NextResponse.json({ error: 'Invalid input', details: (err as Error).message }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from('patients')
    .select('id, organization_id, sms_consent')
    .eq('id', params.id)
    .is('deleted_at', null)
    .single();
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const update: any = { ...body };

  // SMS consent: detect change and log to patient_consents
  const consentChanged = body.sms_consent !== undefined && body.sms_consent !== existing.sms_consent;
  if (consentChanged) {
    update.sms_consent_at = body.sms_consent ? new Date().toISOString() : null;
  }

  const { error } = await supabase.from('patients').update(update).eq('id', existing.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (consentChanged) {
    await supabase.from('patient_consents').insert({
      organization_id: existing.organization_id,
      patient_id: existing.id,
      kind: 'sms',
      action: body.sms_consent ? 'granted' : 'revoked',
      granted_via: 'staff_collected',
      recorded_by: user.id,
    });

    // If revoked: cancel pending reminders & upsert opt-out
    if (body.sms_consent === false) {
      const { createServiceClient } = await import('@/lib/supabase/server');
      const admin = createServiceClient();
      await admin
        .from('appointment_reminders')
        .update({ status: 'opted_out' })
        .eq('patient_id', existing.id)
        .in('status', ['pending', 'queued']);
    }
  }

  await logAudit({
    organizationId: existing.organization_id,
    userId: user.id,
    action: 'update',
    resourceType: 'patient',
    resourceId: existing.id,
    patientId: existing.id,
    metadata: consentChanged ? { sms_consent_change: body.sms_consent } : undefined,
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { data: existing } = await supabase
    .from('patients')
    .select('id, organization_id')
    .eq('id', params.id)
    .is('deleted_at', null)
    .single();
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { error } = await supabase
    .from('patients')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', existing.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({
    organizationId: existing.organization_id,
    userId: user.id,
    action: 'soft_delete',
    resourceType: 'patient',
    resourceId: existing.id,
    patientId: existing.id,
  });

  return NextResponse.json({ ok: true });
}
