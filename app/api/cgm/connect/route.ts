import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildAuthorizationUrl, isDexcomConfigured } from '@/lib/cgm/dexcom-client';
import { logAudit } from '@/lib/audit';
import { z } from 'zod';
import { randomBytes } from 'node:crypto';

const ConnectSchema = z.object({
  patient_id: z.string().uuid(),
  device: z.enum(['dexcom_g6', 'dexcom_g7']).default('dexcom_g7'),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  if (!isDexcomConfigured()) {
    return NextResponse.json({
      error: 'Dexcom integration is not configured. Set DEXCOM_CLIENT_ID and DEXCOM_CLIENT_SECRET environment variables.',
    }, { status: 503 });
  }

  let payload;
  try {
    payload = ConnectSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single();
  if (!profile) return NextResponse.json({ error: 'No profile' }, { status: 403 });

  const { data: patient } = await supabase
    .from('patients')
    .select('id, organization_id')
    .eq('id', payload.patient_id)
    .single();
  if (!patient) return NextResponse.json({ error: 'Patient not accessible' }, { status: 404 });

  const state = Buffer.from(JSON.stringify({
    patient_id: payload.patient_id,
    user_id: user.id,
    device: payload.device,
    org_id: profile.organization_id,
    nonce: randomBytes(16).toString('hex'),
    ts: Date.now(),
  })).toString('base64url');

  await logAudit({
    organizationId: profile.organization_id,
    userId: user.id,
    action: 'create',
    resourceType: 'cgm_oauth_initiated',
    patientId: payload.patient_id,
    metadata: { device: payload.device },
  });

  const url = buildAuthorizationUrl(state, 'offline_access');
  return NextResponse.json({ authorization_url: url });
}
