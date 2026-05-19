import { NextResponse, type NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { formatAppointmentTime } from '@/lib/sms/reminders';

export const runtime = 'nodejs';

/**
 * GET /r/[token]
 * Patient-facing cancellation page reached from SMS link. Renders a confirm page.
 * The actual cancellation happens on POST.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { token: string } }
) {
  const admin = createServiceClient();
  const { data: reminder } = await admin
    .from('appointment_reminders')
    .select(`
      id, appointment_id, patient_action,
      appointments(
        id, status, starts_at, timezone,
        patients(first_name, last_name),
        provider:users!appointments_provider_id_fkey(last_name, credentials),
        organizations(name, phone)
      )
    `)
    .eq('cancellation_token', params.token)
    .maybeSingle();

  if (!reminder) {
    return new NextResponse(renderHtml('Invalid link', '<p>This cancellation link is not valid or has expired.</p>'), {
      headers: { 'Content-Type': 'text/html' },
    });
  }

  const appt = reminder.appointments as any;
  if (!appt || appt.status === 'cancelled') {
    return new NextResponse(renderHtml('Already cancelled', '<p>This appointment has already been cancelled.</p>'), {
      headers: { 'Content-Type': 'text/html' },
    });
  }

  const fmt = formatAppointmentTime(new Date(appt.starts_at), appt.timezone);
  const html = renderHtml('Cancel appointment', `
    <p>Hi ${appt.patients.first_name},</p>
    <p>You are about to cancel your appointment with <strong>Dr. ${appt.provider.last_name}</strong> on <strong>${fmt.date} at ${fmt.time}</strong>.</p>
    <form method="POST" action="/r/${params.token}">
      <button type="submit" class="primary">Confirm cancellation</button>
    </form>
    <p class="footer">To reschedule instead, call ${appt.organizations.name}${appt.organizations.phone ? ' at ' + appt.organizations.phone : ''}.</p>
  `);
  return new NextResponse(html, { headers: { 'Content-Type': 'text/html' } });
}

export async function POST(
  _request: NextRequest,
  { params }: { params: { token: string } }
) {
  const admin = createServiceClient();
  const { data: reminder } = await admin
    .from('appointment_reminders')
    .select('id, appointment_id, organization_id, patient_id')
    .eq('cancellation_token', params.token)
    .maybeSingle();

  if (!reminder) {
    return new NextResponse(renderHtml('Invalid link', '<p>This cancellation link is not valid.</p>'), {
      headers: { 'Content-Type': 'text/html' },
    });
  }

  await admin
    .from('appointments')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancellation_reason: 'Patient cancelled via SMS link',
    })
    .eq('id', reminder.appointment_id);

  await admin
    .from('appointment_reminders')
    .update({ status: 'cancelled' })
    .eq('appointment_id', reminder.appointment_id)
    .in('status', ['pending', 'queued']);

  await admin
    .from('appointment_reminders')
    .update({ patient_action: 'cancel_requested', patient_action_at: new Date().toISOString() })
    .eq('id', reminder.id);

  return new NextResponse(renderHtml('Cancelled', '<p>Your appointment has been cancelled. The practice has been notified.</p>'), {
    headers: { 'Content-Type': 'text/html' },
  });
}

function renderHtml(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 480px; margin: 60px auto; padding: 32px; color: #1a1a1a; line-height: 1.6; }
h1 { font-size: 28px; margin-bottom: 16px; }
button { background: #0f172a; color: white; border: none; padding: 14px 28px; border-radius: 999px; font-size: 16px; cursor: pointer; }
button:hover { background: #1e293b; }
.footer { color: #64748b; font-size: 14px; margin-top: 32px; }
form { margin: 24px 0; }
</style>
</head>
<body>
<h1>${title}</h1>
${body}
</body>
</html>`;
}
