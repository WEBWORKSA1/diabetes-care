import { NextResponse } from 'next/server';
import { getCurrentPortalSession } from '@/lib/portal/auth';
import { createServiceClient } from '@/lib/supabase/server';
import { z } from 'zod';

const MessageSchema = z.object({
  subject: z.string().min(1).max(150),
  body: z.string().min(1).max(2000),
  priority: z.enum(['routine', 'urgent']).default('routine'),
});

/**
 * POST /api/portal/messages
 * Patient-facing endpoint to send a message to the practice.
 */
export async function POST(request: Request) {
  const session = await getCurrentPortalSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  let body;
  try {
    body = MessageSchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json({ error: 'Invalid input', details: (err as Error).message }, { status: 400 });
  }

  const admin = createServiceClient();
  const { data, error } = await admin
    .from('patient_messages')
    .insert({
      organization_id: session.organization_id,
      patient_id: session.patient_id,
      subject: body.subject,
      body: body.body,
      priority: body.priority,
      triage_flag: body.priority === 'urgent',
    })
    .select('id')
    .single();

  if (error || !data) return NextResponse.json({ error: 'Could not send message' }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id });
}
