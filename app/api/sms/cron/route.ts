import { NextResponse, type NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { sendSms } from '@/lib/sms/twilio';

export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * GET /api/sms/cron
 * Runs every 5 minutes. Sends due reminders.
 * Authenticated via Bearer CRON_SECRET.
 */
export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization');
  const expectedSecret = process.env.CRON_SECRET;
  if (!expectedSecret) return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  if (auth !== `Bearer ${expectedSecret}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createServiceClient();
  const now = new Date().toISOString();

  // Pull due reminders. Lookback to 60 min in case cron missed runs.
  const lookback = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { data: due, error } = await admin
    .from('appointment_reminders')
    .select(`
      id, organization_id, appointment_id, patient_id, kind, to_phone, message_body, attempts,
      appointments(status, deleted_at)
    `)
    .eq('status', 'pending')
    .gte('scheduled_for', lookback)
    .lte('scheduled_for', now)
    .lt('attempts', 3)
    .limit(200);

  if (error) {
    console.error('[sms cron] fetch failed', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const r of due ?? []) {
    const appt = r.appointments as any;
    // Skip if appointment was cancelled or deleted after reminder was queued
    if (!appt || appt.deleted_at || ['cancelled', 'no_show', 'completed'].includes(appt.status)) {
      await admin.from('appointment_reminders').update({ status: 'cancelled' }).eq('id', r.id);
      skipped++;
      continue;
    }

    // Recheck opt-out
    const { data: optOut } = await admin
      .from('sms_opt_outs')
      .select('id')
      .eq('organization_id', r.organization_id)
      .eq('phone', r.to_phone)
      .maybeSingle();
    if (optOut) {
      await admin.from('appointment_reminders').update({ status: 'opted_out' }).eq('id', r.id);
      skipped++;
      continue;
    }

    await admin.from('appointment_reminders').update({ status: 'queued', attempts: r.attempts + 1 }).eq('id', r.id);

    const result = await sendSms({ to: r.to_phone, body: r.message_body });

    if (result.ok) {
      await admin
        .from('appointment_reminders')
        .update({
          status: 'sent',
          twilio_sid: result.sid,
          sent_at: new Date().toISOString(),
        })
        .eq('id', r.id);
      sent++;
    } else {
      await admin
        .from('appointment_reminders')
        .update({
          status: r.attempts + 1 >= 3 ? 'failed' : 'pending',
          twilio_error_code: result.error_code,
          twilio_error_message: result.error_message,
          failed_at: r.attempts + 1 >= 3 ? new Date().toISOString() : null,
        })
        .eq('id', r.id);
      failed++;
    }
  }

  return NextResponse.json({ ok: true, sent, failed, skipped, total: due?.length ?? 0 });
}
