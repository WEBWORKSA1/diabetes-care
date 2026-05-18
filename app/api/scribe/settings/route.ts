import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit';
import { z } from 'zod';

const BodySchema = z.object({
  scribe_llm_preference: z.enum(['claude', 'gpt4o']).optional(),
  audio_retention_days: z.number().int().min(1).max(90).optional(),
  scribe_enabled: z.boolean().optional(),
});

/**
 * GET /api/scribe/settings — read org-level scribe settings
 * POST /api/scribe/settings — update (owner only)
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { data: profile } = await supabase
    .from('users')
    .select('organization_id, role')
    .eq('id', user.id)
    .single();
  if (!profile) return NextResponse.json({ error: 'No profile' }, { status: 403 });

  const { data: org } = await supabase
    .from('organizations')
    .select('scribe_llm_preference, audio_retention_days, scribe_enabled')
    .eq('id', profile.organization_id)
    .single();

  return NextResponse.json({ settings: org, is_owner: profile.role === 'owner' });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  let body;
  try {
    body = BodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from('users')
    .select('organization_id, role')
    .eq('id', user.id)
    .single();
  if (!profile) return NextResponse.json({ error: 'No profile' }, { status: 403 });
  if (profile.role !== 'owner') {
    return NextResponse.json({ error: 'Only practice owners can change scribe settings' }, { status: 403 });
  }

  const admin = createServiceClient();
  const update: any = {};
  if (body.scribe_llm_preference !== undefined) update.scribe_llm_preference = body.scribe_llm_preference;
  if (body.audio_retention_days !== undefined) update.audio_retention_days = body.audio_retention_days;
  if (body.scribe_enabled !== undefined) update.scribe_enabled = body.scribe_enabled;

  const { error } = await admin
    .from('organizations')
    .update(update)
    .eq('id', profile.organization_id);

  if (error) return NextResponse.json({ error: 'Update failed' }, { status: 500 });

  await logAudit({
    organizationId: profile.organization_id,
    userId: user.id,
    action: 'permission_change',
    resourceType: 'scribe_settings',
    metadata: update,
  });

  return NextResponse.json({ ok: true });
}
