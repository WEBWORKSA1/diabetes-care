import { NextResponse, type NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { verifyTwilioSignature, normalizePhone } from '@/lib/sms/twilio';

export const runtime = 'nodejs';

/**
 * POST /api/sms/inbound
 * Twilio webhook for inbound SMS (used to detect STOP keywords for opt-out).
 *
 * Twilio also auto-handles STOP per their compliance — but we mirror it in our
 * sms_opt_outs table to prevent re-queueing reminders.
 */
export async function POST(request: NextRequest) {
  const body = await request.formData();
  const params: Record<string, string> = {};
  body.forEach((v, k) => { params[k] = String(v); });

  const signature = request.headers.get('x-twilio-signature') ?? '';
  const url = request.url;

  const validSig = await verifyTwilioSignature(signature, url, params);
  if (!validSig) {
    console.warn('[sms inbound] invalid Twilio signature');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const from = params.From ?? '';
  const bodyText = (params.Body ?? '').trim().toUpperCase();

  if (!from) return new NextResponse('<Response/>', { headers: { 'Content-Type': 'text/xml' } });

  const phone = normalizePhone(from);
  if (!phone) return new NextResponse('<Response/>', { headers: { 'Content-Type': 'text/xml' } });

  const admin = createServiceClient();

  // STOP / UNSUBSCRIBE / CANCEL / END / QUIT
  if (['STOP', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT'].includes(bodyText)) {
    // Find patient(s) with this phone across orgs and opt them out per-org
    const { data: patients } = await admin
      .from('patients')
      .select('id, organization_id')
      .or(`phone_mobile.eq.${from},phone_mobile.eq.${phone}`)
      .is('deleted_at', null);

    for (const p of patients ?? []) {
      await admin
        .from('sms_opt_outs')
        .upsert({
          organization_id: p.organization_id,
          phone,
          patient_id: p.id,
          source: 'sms_stop',
        }, { onConflict: 'organization_id,phone' });

      // Cancel any pending reminders
      await admin
        .from('appointment_reminders')
        .update({ status: 'opted_out', patient_action: 'stop', patient_action_at: new Date().toISOString() })
        .eq('patient_id', p.id)
        .in('status', ['pending', 'queued']);
    }

    // Twilio auto-confirms STOP — we don't need to reply.
    return new NextResponse('<Response/>', { headers: { 'Content-Type': 'text/xml' } });
  }

  // START / UNSTOP - re-opt-in
  if (['START', 'UNSTOP', 'YES'].includes(bodyText)) {
    await admin.from('sms_opt_outs').delete().eq('phone', phone);
    return new NextResponse('<Response/>', { headers: { 'Content-Type': 'text/xml' } });
  }

  // Unknown body — ignore silently for now (we are not a chat service)
  return new NextResponse('<Response/>', { headers: { 'Content-Type': 'text/xml' } });
}
