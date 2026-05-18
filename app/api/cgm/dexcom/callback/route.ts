import { NextResponse, type NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { exchangeCodeForTokens } from '@/lib/cgm/dexcom-client';
import { encryptToken } from '@/lib/cgm/encryption';
import { syncConnection } from '@/lib/cgm/sync-worker';
import { logAudit } from '@/lib/audit';

export const runtime = 'nodejs';

/**
 * GET /api/cgm/dexcom/callback?code=...&state=...
 *
 * Dexcom redirects here after the patient authorizes.
 * - Validates state
 * - Exchanges code for tokens
 * - Persists connection (encrypted tokens)
 * - Kicks off initial 90-day sync in background (best effort)
 * - Redirects to patient page with success or error message
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const errorParam = searchParams.get('error');

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? origin;

  if (errorParam) {
    return NextResponse.redirect(`${appUrl}/app/cgm?error=${encodeURIComponent(errorParam)}`);
  }
  if (!code || !state) {
    return NextResponse.redirect(`${appUrl}/app/cgm?error=missing_params`);
  }

  const admin = createServiceClient();

  // 1. Validate state
  const { data: stateRow } = await admin
    .from('cgm_oauth_states')
    .select('*')
    .eq('state', state)
    .single();

  if (!stateRow) {
    return NextResponse.redirect(`${appUrl}/app/cgm?error=invalid_state`);
  }
  if (new Date(stateRow.expires_at) < new Date()) {
    await admin.from('cgm_oauth_states').delete().eq('state', state);
    return NextResponse.redirect(`${appUrl}/app/cgm?error=state_expired`);
  }

  // Consume state (one-shot)
  await admin.from('cgm_oauth_states').delete().eq('state', state);

  // 2. Exchange code for tokens
  let tokens;
  try {
    tokens = await exchangeCodeForTokens(code);
  } catch (err) {
    console.error('[oauth callback] token exchange failed', err);
    return NextResponse.redirect(
      `${appUrl}/app/patients/${stateRow.patient_id}?cgm_error=${encodeURIComponent((err as Error).message)}`
    );
  }

  // 3. Persist connection
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

  // Upsert: same patient + device replaces previous connection
  const { data: existing } = await admin
    .from('cgm_connections')
    .select('id')
    .eq('patient_id', stateRow.patient_id)
    .eq('device', stateRow.device)
    .maybeSingle();

  let connectionId: string;
  if (existing) {
    await admin
      .from('cgm_connections')
      .update({
        encrypted_access_token: encryptToken(tokens.access_token),
        encrypted_refresh_token: encryptToken(tokens.refresh_token),
        token_expires_at: expiresAt.toISOString(),
        is_active: true,
        sync_status: 'idle',
        last_error: null,
        consecutive_failures: 0,
        deleted_at: null,
      })
      .eq('id', existing.id);
    connectionId = existing.id;
  } else {
    const { data: inserted, error: insErr } = await admin
      .from('cgm_connections')
      .insert({
        patient_id: stateRow.patient_id,
        organization_id: stateRow.organization_id,
        device: stateRow.device,
        encrypted_access_token: encryptToken(tokens.access_token),
        encrypted_refresh_token: encryptToken(tokens.refresh_token),
        token_expires_at: expiresAt.toISOString(),
        is_active: true,
      })
      .select('id')
      .single();

    if (insErr || !inserted) {
      console.error('[oauth callback] insert connection failed', insErr);
      return NextResponse.redirect(
        `${appUrl}/app/patients/${stateRow.patient_id}?cgm_error=insert_failed`
      );
    }
    connectionId = inserted.id;
  }

  // 4. Audit
  await logAudit({
    organizationId: stateRow.organization_id,
    userId: stateRow.user_id,
    action: 'create',
    resourceType: 'cgm_connection',
    resourceId: connectionId,
    patientId: stateRow.patient_id,
    metadata: { device: stateRow.device, event: 'oauth_complete' },
  });

  // 5. Kick off initial 90-day sync (don't await beyond redirect; fire-and-log)
  syncConnection({ connectionId, triggeredBy: 'initial', windowDays: 90 })
    .then((r) => console.log('[oauth callback] initial sync:', r))
    .catch((e) => console.error('[oauth callback] initial sync failed', e));

  return NextResponse.redirect(
    `${appUrl}/app/patients/${stateRow.patient_id}?cgm_connected=1`
  );
}
