import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit';
import { createMagicLink, buildMagicLinkUrl, composeMagicLinkSms } from '@/lib/portal/auth';
import { sendSms, normalizePhone } from '@/lib/sms/twilio';
import { z } from 'zod';

const InviteSchema = z.object({
  patient_id: z.string().uuid(),
  destination: z.enum(['home', 'appointment', 'intake', 'results', 'message']).default('home'),
  destination_ref: z.string().uuid().optional(),
  channel: z.enum(['sms', 'email']).default('sms'),
});

/**
 * POST /api/portal/invite
 * Generates a magic link and (optionally) sends it via SMS/email.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  let body;
  try {
    body = InviteSchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json({ error: 'Invalid input', details: (err as Error).message }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single();
  if (!profile) return NextResponse.json({ error: 'No profile' }, { status: 403 });

  const { data: patient } = await supabase
    .from('patients')
    .select('id, first_name, phone_mobile, email, sms_consent')
    .eq('id', body.patient_id)
    .is('deleted_at', null)
    .single();
  if (!patient) return NextResponse.json({ error: 'Patient not found' }, { status: 404 });

  const { data: org } = await supabase
    .from('organizations')
    .select('name, sms_from_name, portal_enabled')
    .eq('id', profile.organization_id)
    .single();
  if (!org?.portal_enabled) {
    return NextResponse.json({ error: 'Patient portal is not enabled for this practice. Enable it in Settings.' }, { status: 403 });
  }

  // Pre-flight checks
  if (body.channel === 'sms') {
    if (!patient.phone_mobile) return NextResponse.json({ error: 'Patient has no mobile phone on file' }, { status: 400 });
    if (!patient.sms_consent) return NextResponse.json({ error: 'Patient has not consented to SMS. Capture consent first.' }, { status: 400 });
  } else if (body.channel === 'email' && !patient.email) {
    return NextResponse.json({ error: 'Patient has no email on file' }, { status: 400 });
  }

  // Create the link
  const { token, id: linkId } = await createMagicLink({
    organizationId: profile.organization_id,
    patientId: patient.id,
    destination: body.destination,
    destinationRef: body.destination_ref,
    sentVia: body.channel,
  });
  const url = buildMagicLinkUrl(token);

  // Deliver
  let delivered = false;
  let deliveryError: string | null = null;
  const practiceName = org.sms_from_name || org.name;

  if (body.channel === 'sms') {
    const phone = normalizePhone(patient.phone_mobile!);
    if (phone) {
      const smsBody = composeMagicLinkSms({
        patientFirstName: patient.first_name,
        practiceName,
        url,
        destination: body.destination,
      });
      const result = await sendSms({ to: phone, body: smsBody });
      delivered = result.ok;
      deliveryError = result.error_message ?? null;
    } else {
      deliveryError = 'Could not normalize phone number';
    }
  } else if (body.channel === 'email') {
    // Email delivery is a placeholder — wire up Postmark/SES in production
    deliveryError = 'Email delivery not implemented yet. Copy the link manually.';
  }

  await logAudit({
    organizationId: profile.organization_id,
    userId: user.id,
    action: 'create',
    resourceType: 'portal_magic_link',
    resourceId: linkId,
    patientId: patient.id,
    metadata: { channel: body.channel, destination: body.destination, delivered, deliveryError },
  });

  return NextResponse.json({
    ok: true,
    url, // returned so practice staff can also copy/paste manually if SMS failed
    delivered,
    delivery_error: deliveryError,
  });
}
