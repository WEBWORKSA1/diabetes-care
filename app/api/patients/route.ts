import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit';
import { z } from 'zod';

const PatientSchema = z.object({
  mrn: z.string().min(1).max(50),
  first_name: z.string().min(1).max(100),
  last_name: z.string().min(1).max(100),
  date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sex_at_birth: z.enum(['male', 'female', 'intersex', 'unknown']),
  diabetes_type: z.enum(['type_1', 'type_2', 'gestational', 'prediabetes', 'mody', 'lada', 'other']),
  diagnosis_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().max(30).optional().or(z.literal('')),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  let payload;
  try {
    payload = PatientSchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: 'No profile' }, { status: 403 });
  }

  const insertPayload: any = {
    organization_id: profile.organization_id,
    mrn: payload.mrn,
    first_name: payload.first_name,
    last_name: payload.last_name,
    date_of_birth: payload.date_of_birth,
    sex_at_birth: payload.sex_at_birth,
    diabetes_type: payload.diabetes_type,
    primary_provider_id: user.id,
  };
  if (payload.diagnosis_date) insertPayload.diagnosis_date = payload.diagnosis_date;
  if (payload.email) insertPayload.email = payload.email;
  if (payload.phone) insertPayload.phone = payload.phone;

  const { data: patient, error } = await supabase
    .from('patients')
    .insert(insertPayload)
    .select('id')
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'A patient with this MRN already exists.' }, { status: 409 });
    }
    console.error('[patients] create failed', error);
    return NextResponse.json({ error: 'Could not create patient' }, { status: 500 });
  }

  await logAudit({
    organizationId: profile.organization_id,
    userId: user.id,
    action: 'create',
    resourceType: 'patient',
    resourceId: patient.id,
    patientId: patient.id,
  });

  return NextResponse.json({ id: patient.id });
}
