import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit';
import { randomBytes } from 'node:crypto';
import { createMagicLink, buildMagicLinkUrl, composeMagicLinkSms } from '@/lib/portal/auth';
import { sendSms, normalizePhone } from '@/lib/sms/twilio';
import { z } from 'zod';

const SendSchema = z.object({
  patient_id: z.string().uuid(),
  intake_form_id: z.string().uuid(),
  appointment_id: z.string().uuid().optional(),
  send_via: z.enum(['sms', 'email', 'manual']).default('sms'),
});

/**
 * POST /api/intake-forms/send
 * Send an intake form to a patient. Creates the response row + magic link.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  let body;
  try {
    body = SendSchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json({ error: 'Invalid input', details: (err as Error).message }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single();
  if (!profile) return NextResponse.json({ error: 'No profile' }, { status: 403 });

  const [{ data: patient }, { data: form }, { data: org }] = await Promise.all([
    supabase.from('patients').select('id, first_name, phone_mobile, email, sms_consent').eq('id', body.patient_id).is('deleted_at', null).single(),
    supabase.from('intake_forms').select('id, name, kind').eq('id', body.intake_form_id).eq('is_active', true).single(),
    supabase.from('organizations').select('name, sms_from_name, portal_enabled').eq('id', profile.organization_id).single(),
  ]);

  if (!patient) return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
  if (!form) return NextResponse.json({ error: 'Intake form not found' }, { status: 404 });
  if (!org?.portal_enabled) return NextResponse.json({ error: 'Portal not enabled' }, { status: 403 });

  const accessToken = randomBytes(32).toString('base64url');
  const admin = createServiceClient();

  // Insert response row
  const { data: response, error: insErr } = await admin
    .from('intake_form_responses')
    .insert({
      organization_id: profile.organization_id,
      intake_form_id: form.id,
      patient_id: patient.id,
      appointment_id: body.appointment_id ?? null,
      status: 'sent',
      access_token: accessToken,
    })
    .select('id')
    .single();

  if (insErr || !response) {
    console.error('[intake send] insert failed', insErr);
    return NextResponse.json({ error: 'Could not create intake', details: insErr?.message }, { status: 500 });
  }

  // Create magic link pointing to the intake form
  const { token } = await createMagicLink({
    organizationId: profile.organization_id,
    patientId: patient.id,
    destination: 'intake',
    destinationRef: response.id,
    sentVia: body.send_via === 'manual' ? 'manual' : body.send_via,
  });
  const url = buildMagicLinkUrl(token);

  let delivered = false;
  let deliveryError: string | null = null;

  if (body.send_via === 'sms' && patient.phone_mobile && patient.sms_consent) {
    const phone = normalizePhone(patient.phone_mobile);
    if (phone) {
      const smsBody = composeMagicLinkSms({
        patientFirstName: patient.first_name,
        practiceName: org.sms_from_name || org.name,
        url,
        destination: 'intake',
      });
      const result = await sendSms({ to: phone, body: smsBody });
      delivered = result.ok;
      deliveryError = result.error_message ?? null;
    }
  } else if (body.send_via === 'sms' && !patient.sms_consent) {
    deliveryError = 'Patient has not consented to SMS. The link is created but not sent.';
  } else if (body.send_via === 'email') {
    deliveryError = 'Email delivery not implemented yet. Use the manual link.';
  }

  await logAudit({
    organizationId: profile.organization_id,
    userId: user.id,
    action: 'create',
    resourceType: 'intake_form_response',
    resourceId: response.id,
    patientId: patient.id,
    metadata: { intake_form_id: form.id, send_via: body.send_via, delivered },
  });

  return NextResponse.json({ ok: true, response_id: response.id, url, delivered, delivery_error: deliveryError });
}
