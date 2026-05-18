import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit';
import { hashSignPin, verifySignPin } from '@/lib/clinical/sign-pin';
import { z } from 'zod';

const SetPinSchema = z.object({
  pin: z.string().regex(/^\d{4,6}$/),
  current_pin: z.string().regex(/^\d{4,6}$/).optional(),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  let payload;
  try {
    payload = SetPinSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: 'PIN must be 4-6 digits' }, { status: 400 });
  }

  const admin = createServiceClient();
  const { data: userRow } = await admin
    .from('users')
    .select('id, sign_pin_hash, organization_id')
    .eq('id', user.id)
    .single();

  if (!userRow) return NextResponse.json({ error: 'No profile' }, { status: 403 });

  if (userRow.sign_pin_hash) {
    if (!payload.current_pin) {
      return NextResponse.json({ error: 'Current PIN required to change.' }, { status: 400 });
    }
    const ok = await verifySignPin(payload.current_pin, userRow.sign_pin_hash);
    if (!ok) {
      await logAudit({
        organizationId: userRow.organization_id,
        userId: user.id,
        action: 'failed_login',
        resourceType: 'sign_pin_change',
        metadata: { reason: 'invalid_current_pin' },
      });
      return NextResponse.json({ error: 'Current PIN incorrect' }, { status: 403 });
    }
  }

  let newHash: string;
  try {
    newHash = await hashSignPin(payload.pin);
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Could not set PIN' }, { status: 400 });
  }

  const { error } = await admin
    .from('users')
    .update({
      sign_pin_hash: newHash,
      sign_pin_set_at: new Date().toISOString(),
    })
    .eq('id', user.id);

  if (error) {
    console.error('[sign_pin] update failed', error);
    return NextResponse.json({ error: 'Could not save PIN' }, { status: 500 });
  }

  await logAudit({
    organizationId: userRow.organization_id,
    userId: user.id,
    action: 'permission_change',
    resourceType: 'sign_pin',
    metadata: { event: userRow.sign_pin_hash ? 'changed' : 'set' },
  });

  return NextResponse.json({ ok: true });
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const admin = createServiceClient();
  const { data } = await admin
    .from('users')
    .select('sign_pin_hash, sign_pin_set_at')
    .eq('id', user.id)
    .single();

  return NextResponse.json({
    has_pin: !!data?.sign_pin_hash,
    set_at: data?.sign_pin_set_at ?? null,
  });
}
