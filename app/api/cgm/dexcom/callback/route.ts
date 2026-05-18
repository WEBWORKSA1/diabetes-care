import { NextResponse, type NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { exchangeCodeForTokens } from '@/lib/cgm/dexcom-client';
import { logAudit } from '@/lib/audit';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const stateParam = searchParams.get('state');
  const error = searchParams.get('error');

  if (error) {
    return NextResponse.redirect(`${origin}/app/cgm?error=${encodeURIComponent(error)}`);
  }
  if (!code || !stateParam) {
    return NextResponse.redirect(`${origin}/app/cgm?error=missing_params`);
  }

  let state: any;
  try {
    state = JSON.parse(Buffer.from(stateParam, 'base64url').toString('utf-8'));
  } catch {
    return NextResponse.redirect(`${origin}/app/cgm?error=invalid_state`);
  }

  if (!state.ts || Date.now() - state.ts > 10 * 60 * 1000) {
    return NextResponse.redirect(`${origin}/app/cgm?error=state_expired`);
  }

  let tokens;
  try {
    tokens = await exchangeCodeForTokens(code);
  } catch (e: any) {
    return NextResponse.redirect(`${origin}/app/cgm?error=${encodeURIComponent('token_exchange_failed')}`);
  }

  const admin = createServiceClient();
  const { data: encAccess } = await admin.rpc('encrypt_cgm_token' as any, { plaintext: tokens.access_token });
  const { data: encRefresh } = await admin.rpc('encrypt_cgm_token' as any, { plaintext: tokens.refresh_token });

  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  const { data: existing } = await admin
    .from('cgm_connections')
    .select('id')
    .eq('patient_id', state.patient_id)
    .eq('device', state.device)
    .is('deleted_at', null)
    .maybeSingle();

  let connectionId: string;

  if (existing) {
    const { error: updateErr } = await admin
      .from('cgm_connections')
      .update({
        encrypted_access_token: encAccess,
        encrypted_refresh_token: encRefresh,
        token_expires_at: expiresAt,
        is_active: true,
        sync_status: 'idle',
        last_sync_error: null,
      })
      .eq('id', existing.id);
    if (updateErr) {
      return NextResponse.redirect(`${origin}/app/cgm?error=db_update_failed`);
    }
    connectionId = existing.id;
  } else {
    const { data: inserted, error: insertErr } = await admin
      .from('cgm_connections')
      .insert({
        patient_id: state.patient_id,
        organization_id: state.org_id,
        device: state.device,
        encrypted_access_token: encAccess,
        encrypted_refresh_token: encRefresh,
        token_expires_at: expiresAt,
        is_active: true,
        sync_status: 'idle',
      })
      .select('id')
      .single();
    if (insertErr || !inserted) {
      return NextResponse.redirect(`${origin}/app/cgm?error=db_insert_failed`);
    }
    connectionId = inserted.id;
  }

  await logAudit({
    organizationId: state.org_id,
    userId: state.user_id,
    action: 'create',
    resourceType: 'cgm_connection',
    resourceId: connectionId,
    patientId: state.patient_id,
    metadata: { device: state.device, event: 'oauth_completed' },
  });

  return NextResponse.redirect(`${origin}/app/patients/${state.patient_id}?cgm_connected=1`);
}
