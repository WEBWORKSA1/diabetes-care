import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit';
import { z } from 'zod';

const CreateSchema = z.object({
  patient_id: z.string().uuid(),
  encounter_id: z.string().uuid().optional(),
});

/**
 * POST /api/scribe/sessions
 * Creates a new scribe session in 'recording' state. Returns id for client to use
 * during upload.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  let body;
  try {
    body = CreateSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single();
  if (!profile) return NextResponse.json({ error: 'No profile' }, { status: 403 });

  const { data: org } = await supabase
    .from('organizations')
    .select('scribe_enabled, audio_retention_days')
    .eq('id', profile.organization_id)
    .single();
  if (!org?.scribe_enabled) return NextResponse.json({ error: 'AI Scribe not enabled for this practice' }, { status: 403 });

  const retentionDays = org.audio_retention_days ?? 30;
  const expiresAt = new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000);

  const { data: session, error } = await supabase
    .from('scribe_sessions')
    .insert({
      organization_id: profile.organization_id,
      patient_id: body.patient_id,
      provider_id: user.id,
      encounter_id: body.encounter_id ?? null,
      created_by: user.id,
      status: 'recording',
      expires_at: expiresAt.toISOString(),
    })
    .select('id')
    .single();

  if (error || !session) {
    console.error('[scribe sessions] insert failed', error);
    return NextResponse.json({ error: 'Could not create session' }, { status: 500 });
  }

  await logAudit({
    organizationId: profile.organization_id,
    userId: user.id,
    action: 'create',
    resourceType: 'scribe_session',
    resourceId: session.id,
    patientId: body.patient_id,
  });

  return NextResponse.json({ id: session.id });
}
