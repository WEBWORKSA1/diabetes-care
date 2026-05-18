import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { buildAuthorizationUrl } from '@/lib/cgm/dexcom-client';
import { logAudit } from '@/lib/audit';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';

const BodySchema = z.object({
  patient_id: z.string().uuid(),
  device: z.enum(['dexcom_g6', 'dexcom_g7']).default('dexcom_g7'),
});

/**
 * POST /api/cgm/oauth/start
 * Generates a CSRF state, persists it, returns Dexcom authorization URL.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  let payload;
  try {
    payload = BodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  // Verify the patient belongs to this org
  const { data: profile } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single();
  if (!profile) return NextResponse.json({ error: 'No profile' }, { status: 403 });

  const { data: patient } = await supabase
    .from('patients')
    .select('id, first_name, last_name')
    .eq('id', payload.patient_id)
    .is('deleted_at', null)
    .single();
  if (!patient) return NextResponse.json({ error: 'Patient not found' }, { status: 404 });

  // Create CSRF state
  const state = randomBytes(24).toString('hex');
  const admin = createServiceClient();
  const { error: insErr } = await admin.from('cgm_oauth_states').insert({
    state,
    organization_id: profile.organization_id,
    patient_id: patient.id,
    user_id: user.id,
    device: payload.device,
  });
  if (insErr) {
    console.error('[oauth start] failed to persist state', insErr);
    return NextResponse.json({ error: 'Could not start OAuth flow' }, { status: 500 });
  }

  let authUrl: string;
  try {
    authUrl = buildAuthorizationUrl(state);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }

  await logAudit({
    organizationId: profile.organization_id,
    userId: user.id,
    action: 'create',
    resourceType: 'cgm_oauth_request',
    patientId: patient.id,
    metadata: { device: payload.device, state },
  });

  return NextResponse.json({ authorization_url: authUrl, state });
}
