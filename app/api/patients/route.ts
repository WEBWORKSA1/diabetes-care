import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit';
import { z } from 'zod';

// Optional/nullable strings: accept '' as 'omit'
const optStr = (max = 200) => z.string().max(max).optional().or(z.literal('').transform(() => undefined));
const optEmail = z.string().email().max(200).optional().or(z.literal('').transform(() => undefined));
const optDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('').transform(() => undefined));

const PatientSchema = z.object({
  mrn: z.string().min(1).max(50),
  first_name: z.string().min(1).max(100),
  last_name: z.string().min(1).max(100),
  date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sex_at_birth: z.enum(['male', 'female', 'intersex', 'unknown']),
  diabetes_type: z.enum(['type_1', 'type_2', 'gestational', 'prediabetes', 'mody', 'lada', 'other']),
  diagnosis_date: optDate,
  email: optEmail,
  phone: optStr(30),
  phone_mobile: optStr(30),
  sms_consent: z.boolean().optional(),
  address_line1: optStr(200),
  address_line2: optStr(200),
  city: optStr(100),
  state: optStr(50),
  postal_code: optStr(20),
  country: optStr(50),
  race: optStr(50),
  ethnicity: optStr(50),
  preferred_language: optStr(20),
  emergency_contact_name: optStr(150),
  emergency_contact_relationship: optStr(50),
  emergency_contact_phone: optStr(30),
  insurance_carrier: optStr(150),
  insurance_member_id: optStr(100),
  insurance_group_number: optStr(100),
  primary_provider_id: z.string().uuid().optional(),
});

/**
 * GET /api/patients?search=...&limit=10
 * Search patients by name or MRN in current org.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const search = (searchParams.get('search') ?? '').trim();
  const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit') ?? 10)));

  let query = supabase
    .from('patients')
    .select('id, first_name, last_name, mrn, date_of_birth, diabetes_type, phone_mobile, sms_consent')
    .is('deleted_at', null)
    .order('last_name')
    .limit(limit);

  if (search.length >= 1) {
    // Search by MRN exact, first name prefix, last name prefix
    const term = search.replace(/[%,]/g, '');
    query = query.or(`mrn.ilike.${term}%,first_name.ilike.${term}%,last_name.ilike.${term}%`);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ patients: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  let payload;
  try {
    payload = PatientSchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json({ error: 'Invalid input', details: (err as Error).message }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single();
  if (!profile) return NextResponse.json({ error: 'No profile' }, { status: 403 });

  const insertPayload: any = {
    organization_id: profile.organization_id,
    mrn: payload.mrn,
    first_name: payload.first_name,
    last_name: payload.last_name,
    date_of_birth: payload.date_of_birth,
    sex_at_birth: payload.sex_at_birth,
    diabetes_type: payload.diabetes_type,
    primary_provider_id: payload.primary_provider_id ?? user.id,
    country: payload.country ?? 'US',
    preferred_language: payload.preferred_language ?? 'en',
  };

  const optionalFields = [
    'diagnosis_date', 'email', 'phone', 'phone_mobile',
    'address_line1', 'address_line2', 'city', 'state', 'postal_code',
    'race', 'ethnicity',
    'emergency_contact_name', 'emergency_contact_relationship', 'emergency_contact_phone',
    'insurance_carrier', 'insurance_member_id', 'insurance_group_number',
  ] as const;
  for (const k of optionalFields) {
    if ((payload as any)[k]) insertPayload[k] = (payload as any)[k];
  }

  // SMS consent handling: if granted, set the flag + timestamp + log to patient_consents
  if (payload.sms_consent === true) {
    insertPayload.sms_consent = true;
    insertPayload.sms_consent_at = new Date().toISOString();
  }

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

  // Log SMS consent if granted
  if (payload.sms_consent === true) {
    await supabase.from('patient_consents').insert({
      organization_id: profile.organization_id,
      patient_id: patient.id,
      kind: 'sms',
      action: 'granted',
      granted_via: 'staff_collected',
      recorded_by: user.id,
    });
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
