/**
 * CGM sync engine
 *
 * Pulls glucose readings from Dexcom for one connection, handles token refresh,
 * upserts readings to cgm_readings table, runs pattern detection, writes alerts.
 */

import { createServiceClient } from '@/lib/supabase/server';
import { fetchEGVs, refreshAccessToken } from './dexcom-client';
import { detectAllPatterns, type DetectedPattern } from '@/lib/clinical/cgm-patterns';
import { DEFAULT_THRESHOLDS, type GlucoseThresholds } from '@/lib/clinical/glucose-stats';

export interface SyncResult {
  connection_id: string;
  patient_id: string;
  readings_fetched: number;
  readings_inserted: number;
  patterns_detected: number;
  error?: string;
  warning?: string;
}

export async function syncConnection(connectionId: string): Promise<SyncResult> {
  const admin = createServiceClient();

  const { data: conn, error: connErr } = await admin
    .from('cgm_connections')
    .select(`
      id, patient_id, organization_id, device, external_user_id,
      encrypted_access_token, encrypted_refresh_token, token_expires_at,
      last_synced_at, sync_status, readings_synced_total
    `)
    .eq('id', connectionId)
    .eq('is_active', true)
    .is('deleted_at', null)
    .single();

  if (connErr || !conn) {
    return {
      connection_id: connectionId,
      patient_id: '',
      readings_fetched: 0,
      readings_inserted: 0,
      patterns_detected: 0,
      error: 'Connection not found or inactive',
    };
  }

  // Decrypt via SQL function
  const { data: accessRow } = await admin.rpc('decrypt_cgm_token' as any, {
    ciphertext: conn.encrypted_access_token,
  });
  const { data: refreshRow } = await admin.rpc('decrypt_cgm_token' as any, {
    ciphertext: conn.encrypted_refresh_token,
  });
  let accessToken: string | null = (accessRow as any) ?? null;
  let refreshToken: string | null = (refreshRow as any) ?? null;

  if (!accessToken || !refreshToken) {
    return setError(admin, connectionId, conn.patient_id, 'Failed to decrypt stored CGM tokens');
  }

  await admin
    .from('cgm_connections')
    .update({ sync_status: 'syncing', last_sync_error: null })
    .eq('id', connectionId);

  const now = new Date();
  const lastSynced = conn.last_synced_at ? new Date(conn.last_synced_at) : null;
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const startDate = lastSynced && lastSynced > sevenDaysAgo ? lastSynced : sevenDaysAgo;

  const tokenExpired = !conn.token_expires_at || new Date(conn.token_expires_at) <= new Date(now.getTime() + 60 * 1000);
  if (tokenExpired) {
    try {
      const newTokens = await refreshAccessToken(refreshToken);
      accessToken = newTokens.access_token;
      refreshToken = newTokens.refresh_token;
      const expiresAt = new Date(now.getTime() + newTokens.expires_in * 1000).toISOString();

      const { data: encA } = await admin.rpc('encrypt_cgm_token' as any, { plaintext: accessToken });
      const { data: encR } = await admin.rpc('encrypt_cgm_token' as any, { plaintext: refreshToken });

      await admin
        .from('cgm_connections')
        .update({
          encrypted_access_token: encA as any,
          encrypted_refresh_token: encR as any,
          token_expires_at: expiresAt,
        })
        .eq('id', connectionId);
    } catch (e: any) {
      return setError(admin, connectionId, conn.patient_id, `Token refresh failed: ${e.message ?? e}`, 'expired');
    }
  }

  let egvs;
  try {
    egvs = await fetchEGVs(accessToken!, startDate, now);
  } catch (e: any) {
    return setError(admin, connectionId, conn.patient_id, `EGV fetch failed: ${e.message ?? e}`);
  }

  let inserted = 0;
  if (egvs.length > 0) {
    const rows = egvs
      .filter((e) => e.value && e.systemTime)
      .map((e) => ({
        patient_id: conn.patient_id,
        organization_id: conn.organization_id,
        connection_id: conn.id,
        recorded_at: e.systemTime,
        glucose_mg_dl: e.value,
        trend: e.trend ?? null,
        raw_payload: { recordId: e.recordId, displayTime: e.displayTime, trendRate: e.trendRate, unit: e.unit },
      }));

    const { data: insertedRows, error: insertErr } = await admin
      .from('cgm_readings')
      .upsert(rows, { onConflict: 'patient_id,recorded_at,connection_id', ignoreDuplicates: true })
      .select('id');

    if (insertErr) {
      return setError(admin, connectionId, conn.patient_id, `Reading insert failed: ${insertErr.message}`);
    }
    inserted = insertedRows?.length ?? 0;
  }

  await admin
    .from('cgm_connections')
    .update({
      sync_status: 'idle',
      last_synced_at: now.toISOString(),
      last_sync_error: null,
      readings_synced_total: (conn.readings_synced_total ?? 0) + inserted,
    })
    .eq('id', connectionId);

  const patternStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const { data: recentReadings } = await admin
    .from('cgm_readings')
    .select('recorded_at, glucose_mg_dl, trend')
    .eq('patient_id', conn.patient_id)
    .gte('recorded_at', patternStart.toISOString())
    .order('recorded_at', { ascending: false })
    .limit(5000);

  let patternsDetected = 0;
  if (recentReadings && recentReadings.length >= 50) {
    const { data: customThresholds } = await admin
      .from('cgm_alert_thresholds')
      .select('*')
      .eq('patient_id', conn.patient_id)
      .is('deleted_at', null)
      .maybeSingle();

    const thresholds: GlucoseThresholds = customThresholds
      ? {
          target_low: customThresholds.target_low,
          target_high: customThresholds.target_high,
          low_threshold: customThresholds.low_threshold,
          critical_low_threshold: customThresholds.critical_low_threshold,
          high_threshold: customThresholds.high_threshold,
          critical_high_threshold: customThresholds.critical_high_threshold,
        }
      : DEFAULT_THRESHOLDS;

    const patterns = detectAllPatterns(recentReadings as any, thresholds);
    patternsDetected = await persistPatterns(
      conn.patient_id,
      conn.organization_id,
      patternStart,
      now,
      patterns
    );
  }

  return {
    connection_id: connectionId,
    patient_id: conn.patient_id,
    readings_fetched: egvs.length,
    readings_inserted: inserted,
    patterns_detected: patternsDetected,
  };
}

async function persistPatterns(
  patientId: string,
  organizationId: string,
  periodStart: Date,
  periodEnd: Date,
  patterns: DetectedPattern[]
): Promise<number> {
  if (patterns.length === 0) return 0;
  const admin = createServiceClient();

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const { data: recentPatterns } = await admin
    .from('cgm_patterns')
    .select('pattern_type, severity, detected_at, acknowledged_at')
    .eq('patient_id', patientId)
    .gte('detected_at', sevenDaysAgo.toISOString());

  const recentByType = new Map<string, any>();
  for (const p of recentPatterns ?? []) {
    if (!recentByType.has(p.pattern_type) || new Date(p.detected_at) > new Date(recentByType.get(p.pattern_type).detected_at)) {
      recentByType.set(p.pattern_type, p);
    }
  }

  const toInsert = patterns.filter((p) => {
    const recent = recentByType.get(p.pattern_type);
    if (!recent) return true;
    const hoursSince = (Date.now() - new Date(recent.detected_at).getTime()) / (1000 * 60 * 60);
    if (hoursSince < 24 && recent.severity === p.severity) return false;
    return true;
  }).map((p) => ({
    patient_id: patientId,
    organization_id: organizationId,
    pattern_type: p.pattern_type,
    period_start: periodStart.toISOString(),
    period_end: periodEnd.toISOString(),
    severity: p.severity,
    details: p.details,
  }));

  if (toInsert.length === 0) return 0;

  const { error } = await admin.from('cgm_patterns' as any).insert(toInsert);
  if (error) {
    console.error('[sync] pattern persistence failed', error);
    return 0;
  }
  return toInsert.length;
}

async function setError(
  admin: ReturnType<typeof createServiceClient>,
  connectionId: string,
  patientId: string,
  errorMsg: string,
  status: 'error' | 'expired' = 'error'
): Promise<SyncResult> {
  await admin
    .from('cgm_connections')
    .update({ sync_status: status, last_sync_error: errorMsg })
    .eq('id', connectionId);
  return {
    connection_id: connectionId,
    patient_id: patientId,
    readings_fetched: 0,
    readings_inserted: 0,
    patterns_detected: 0,
    error: errorMsg,
  };
}

export async function syncAllDueConnections(maxConnections = 100): Promise<SyncResult[]> {
  const admin = createServiceClient();
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { data: due } = await admin
    .from('cgm_connections')
    .select('id')
    .eq('is_active', true)
    .is('deleted_at', null)
    .in('sync_status', ['idle', 'error'])
    .or(`last_synced_at.is.null,last_synced_at.lt.${oneHourAgo}`)
    .limit(maxConnections);

  if (!due || due.length === 0) return [];

  const results: SyncResult[] = [];
  for (const conn of due) {
    try {
      const r = await syncConnection(conn.id);
      results.push(r);
    } catch (e: any) {
      results.push({
        connection_id: conn.id,
        patient_id: '',
        readings_fetched: 0,
        readings_inserted: 0,
        patterns_detected: 0,
        error: e?.message ?? String(e),
      });
    }
  }
  return results;
}
