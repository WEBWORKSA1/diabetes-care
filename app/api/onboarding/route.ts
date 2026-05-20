import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { z } from 'zod';

const BodySchema = z.object({
  practice_profile_complete: z.boolean().optional(),
  availability_set: z.boolean().optional(),
  first_patient_added: z.boolean().optional(),
  sms_configured: z.boolean().optional(),
  scribe_tested: z.boolean().optional(),
  dismissed: z.boolean().optional(),
});

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

  const { data } = await supabase
    .from('onboarding_state')
    .select('*')
    .eq('organization_id', profile.organization_id)
    .maybeSingle();

  return NextResponse.json({ state: data, is_owner: profile.role === 'owner' });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  let body;
  try {
    body = BodySchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single();
  if (!profile) return NextResponse.json({ error: 'No profile' }, { status: 403 });

  const update: any = {};
  for (const k of ['practice_profile_complete', 'availability_set', 'first_patient_added', 'sms_configured', 'scribe_tested'] as const) {
    if (body[k] !== undefined) update[k] = body[k];
  }
  if (body.dismissed) update.dismissed_at = new Date().toISOString();

  const admin = createServiceClient();
  const { error } = await admin
    .from('onboarding_state')
    .upsert({ organization_id: profile.organization_id, ...update }, { onConflict: 'organization_id' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
