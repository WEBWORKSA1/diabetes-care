import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit';
import { z } from 'zod';

const BodySchema = z.object({
  portal_enabled: z.boolean().optional(),
  portal_emergency_text: z.string().max(500).optional(),
});

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { data: profile } = await supabase
    .from('users')
    .select('organization_id, role, organizations(portal_enabled, portal_emergency_text)')
    .eq('id', user.id)
    .single();
  if (!profile) return NextResponse.json({ error: 'No profile' }, { status: 403 });

  return NextResponse.json({
    settings: profile.organizations,
    is_owner: profile.role === 'owner',
  });
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
  if (profile.role !== 'owner') return NextResponse.json({ error: 'Owner only' }, { status: 403 });

  const admin = createServiceClient();
  const { error } = await admin.from('organizations').update(body).eq('id', profile.organization_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({
    organizationId: profile.organization_id,
    userId: user.id,
    action: 'permission_change',
    resourceType: 'portal_settings',
    metadata: body,
  });

  return NextResponse.json({ ok: true });
}
