import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit';
import { z } from 'zod';

const RejectSchema = z.object({
  reason: z.string().max(500).optional(),
  draft_id: z.string().uuid().optional(),
});

/**
 * POST /api/scribe/sessions/[id]/reject
 * Provider rejects the draft. Session marked 'rejected'; audio purged if requested.
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  let body;
  try {
    body = RejectSchema.parse(await request.json().catch(() => ({})));
  } catch {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  const { data: session } = await supabase
    .from('scribe_sessions')
    .select('id, organization_id, patient_id, provider_id, status')
    .eq('id', params.id)
    .is('deleted_at', null)
    .single();

  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (session.provider_id !== user.id) {
    return NextResponse.json({ error: 'Only the recording provider can reject' }, { status: 403 });
  }

  await supabase
    .from('scribe_sessions')
    .update({ status: 'rejected', completed_at: new Date().toISOString() })
    .eq('id', session.id);

  await supabase.from('scribe_audit').insert({
    session_id: session.id,
    draft_id: body.draft_id ?? null,
    organization_id: session.organization_id,
    user_id: user.id,
    action: 'reject',
    metadata: { reason: body.reason ?? null },
  });

  await logAudit({
    organizationId: session.organization_id,
    userId: user.id,
    action: 'update',
    resourceType: 'scribe_session',
    resourceId: session.id,
    patientId: session.patient_id,
    metadata: { event: 'rejected', reason: body.reason ?? null },
  });

  return NextResponse.json({ ok: true });
}
