import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit';
import { z } from 'zod';

const BodySchema = z.object({
  sms_enabled: z.boolean().optional(),
  sms_24h_reminder_enabled: z.boolean().optional(),
  sms_2h_reminder_enabled: z.boolean().optional(),
  sms_from_name: z.string().max(64).optional(),
});

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
    .select('organization_id, role')
    .eq('id', user.id)
    .single();
  if (!profile) return NextResponse.json({ error: 'No profile' }, { status: 403 });
  if (profile.role !== 'owner') {
    return NextResponse.json({ error: 'Owner only' }, { status: 403 });
  }

  const admin = createServiceClient();
  const update: any = {};
  if (body.sms_enabled !== undefined) update.sms_enabled = body.sms_enabled;
  if (body.sms_24h_reminder_enabled !== undefined) update.sms_24h_reminder_enabled = body.sms_24h_reminder_enabled;
  if (body.sms_2h_reminder_enabled !== undefined) update.sms_2h_reminder_enabled = body.sms_2h_reminder_enabled;
  if (body.sms_from_name !== undefined) update.sms_from_name = body.sms_from_name;

  const { error } = await admin.from('organizations').update(update).eq('id', profile.organization_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({
    organizationId: profile.organization_id,
    userId: user.id,
    action: 'permission_change',
    resourceType: 'sms_settings',
    metadata: update,
  });

  return NextResponse.json({ ok: true });
}
