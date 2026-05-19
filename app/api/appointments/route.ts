import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit';
import { formatAppointmentTime, REMINDER_TEMPLATES, generateCancellationToken, fitToSegment } from '@/lib/sms/reminders';
import { normalizePhone } from '@/lib/sms/twilio';
import { z } from 'zod';

const CreateSchema = z.object({
  patient_id: z.string().uuid(),
  provider_id: z.string().uuid(),
  starts_at: z.string().datetime(),
  ends_at: z.string().datetime(),
  appointment_type: z.enum(['new_patient', 'follow_up', 'cgm_review', 'glp1_initiation', 'lab_review', 'urgent', 'telehealth', 'other']).default('follow_up'),
  reason: z.string().max(500).optional(),
  notes: z.string().max(2000).optional(),
  timezone: z.string().default('America/New_York'),
  location: z.string().default('in_office'),
});

/**
 * POST /api/appointments
 * Creates an appointment. Checks for conflicts. Queues reminder SMS.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  let body;
  try {
    body = CreateSchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json({ error: 'Invalid input', details: (err as Error).message }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single();
  if (!profile) return NextResponse.json({ error: 'No profile' }, { status: 403 });

  // Conflict check
  const { data: conflicts } = await supabase.rpc('check_appointment_conflict', {
    p_provider_id: body.provider_id,
    p_starts_at: body.starts_at,
    p_ends_at: body.ends_at,
    p_exclude_id: null,
  });

  if (conflicts && conflicts.length > 0) {
    return NextResponse.json({
      error: 'Time slot conflicts with existing appointment',
      conflicts,
    }, { status: 409 });
  }

  // Insert appointment
  const { data: appt, error } = await supabase
    .from('appointments')
    .insert({
      organization_id: profile.organization_id,
      patient_id: body.patient_id,
      provider_id: body.provider_id,
      starts_at: body.starts_at,
      ends_at: body.ends_at,
      appointment_type: body.appointment_type,
      reason: body.reason ?? null,
      notes: body.notes ?? null,
      timezone: body.timezone,
      location: body.location,
      created_by: user.id,
      status: 'scheduled',
    })
    .select('id')
    .single();

  if (error || !appt) {
    console.error('[appointments] insert failed', error);
    return NextResponse.json({ error: 'Could not create appointment' }, { status: 500 });
  }

  await logAudit({
    organizationId: profile.organization_id,
    userId: user.id,
    action: 'create',
    resourceType: 'appointment',
    resourceId: appt.id,
    patientId: body.patient_id,
  });

  // Queue reminders (best effort — don't fail the appointment if SMS prep errors)
  try {
    await queueRemindersForAppointment(appt.id);
  } catch (err) {
    console.error('[appointments] reminder queue failed', err);
  }

  return NextResponse.json({ id: appt.id });
}

/**
 * GET /api/appointments?start=...&end=...&provider_id=...
 * List appointments in a date range.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const start = searchParams.get('start');
  const end = searchParams.get('end');
  const providerId = searchParams.get('provider_id');
  const patientId = searchParams.get('patient_id');

  if (!start || !end) return NextResponse.json({ error: 'start and end required' }, { status: 400 });

  let query = supabase
    .from('appointments')
    .select(`
      id, status, appointment_type, starts_at, ends_at, timezone, reason, location,
      patients(id, first_name, last_name, mrn, phone_mobile),
      provider:users!appointments_provider_id_fkey(id, full_name, credentials)
    `)
    .gte('starts_at', start)
    .lte('starts_at', end)
    .is('deleted_at', null)
    .order('starts_at', { ascending: true });

  if (providerId) query = query.eq('provider_id', providerId);
  if (patientId) query = query.eq('patient_id', patientId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ appointments: data ?? [] });
}

/**
 * Queue reminders for a given appointment. Called from POST and from PATCH (reschedule).
 */
async function queueRemindersForAppointment(appointmentId: string) {
  const admin = createServiceClient();
  const { data: appt } = await admin
    .from('appointments')
    .select(`
      id, organization_id, patient_id, starts_at, timezone, status,
      patients(first_name, phone_mobile, sms_consent),
      provider:users!appointments_provider_id_fkey(last_name, credentials),
      organizations(name, sms_enabled, sms_24h_reminder_enabled, sms_2h_reminder_enabled, sms_from_name)
    `)
    .eq('id', appointmentId)
    .single();

  if (!appt) return;
  if (appt.status === 'cancelled') return;

  const patient = appt.patients as any;
  const provider = appt.provider as any;
  const org = appt.organizations as any;

  if (!org?.sms_enabled) return;
  if (!patient?.sms_consent) return;
  if (!patient?.phone_mobile) return;

  const phone = normalizePhone(patient.phone_mobile);
  if (!phone) return;

  // Check opt-out
  const { data: optOut } = await admin
    .from('sms_opt_outs')
    .select('id')
    .eq('organization_id', appt.organization_id)
    .eq('phone', phone)
    .maybeSingle();
  if (optOut) return;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.diabetes.care';
  const apptDate = new Date(appt.starts_at);
  const formatted = formatAppointmentTime(apptDate, appt.timezone);

  const reminders: Array<{ kind: 'confirm_24h' | 'confirm_2h'; enabled: boolean }> = [
    { kind: 'confirm_24h', enabled: org.sms_24h_reminder_enabled !== false },
    { kind: 'confirm_2h', enabled: org.sms_2h_reminder_enabled !== false },
  ];

  for (const r of reminders) {
    if (!r.enabled) continue;
    const template = REMINDER_TEMPLATES[r.kind];
    const scheduledFor = new Date(apptDate.getTime() + template.scheduledOffsetMs);

    // Skip if reminder time is already in the past
    if (scheduledFor < new Date()) continue;

    const cancellationToken = generateCancellationToken();
    const cancelLink = `${appUrl}/r/${cancellationToken}`;

    const body = fitToSegment(template.buildBody({
      patientFirstName: patient.first_name,
      providerLastName: provider.last_name,
      providerCredentials: provider.credentials,
      practiceName: org.sms_from_name || org.name,
      appointmentDate: formatted.date,
      appointmentTime: formatted.time,
      cancelLink,
      smsFromName: org.sms_from_name || org.name,
    }));

    await admin.from('appointment_reminders').insert({
      organization_id: appt.organization_id,
      appointment_id: appt.id,
      patient_id: appt.patient_id,
      kind: r.kind,
      status: 'pending',
      scheduled_for: scheduledFor.toISOString(),
      to_phone: phone,
      message_body: body,
      cancellation_token: cancellationToken,
    });
  }
}

export { queueRemindersForAppointment };
