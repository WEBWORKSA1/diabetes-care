import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const BodySchema = z.object({
  draft_id: z.string().uuid().optional(),
  action: z.enum(['edit', 'view_audio']),
  section: z.string().optional(),
  original_text: z.string().optional(),
  edited_text: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

/**
 * POST /api/scribe/sessions/[id]/audit
 * Log a granular action (section edit, audio playback) for medico-legal trail.
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
    body = BodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  const { data: session } = await supabase
    .from('scribe_sessions')
    .select('id, organization_id')
    .eq('id', params.id)
    .is('deleted_at', null)
    .single();

  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { error } = await supabase.from('scribe_audit').insert({
    session_id: session.id,
    draft_id: body.draft_id ?? null,
    organization_id: session.organization_id,
    user_id: user.id,
    action: body.action,
    section: body.section ?? null,
    original_text: body.original_text ?? null,
    edited_text: body.edited_text ?? null,
    metadata: body.metadata ?? {},
  });

  if (error) return NextResponse.json({ error: 'Could not log' }, { status: 500 });

  return NextResponse.json({ ok: true });
}
