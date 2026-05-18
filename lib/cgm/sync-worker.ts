/**
 * CGM sync worker.
 *
 * Pulls EGVs from Dexcom for one connection, writes readings, runs pattern
 * detection, generates alerts. Idempotent — readings table has unique
 * (patient_id, recorded_at, connection_id) so duplicate syncs are safe.
 *
 * Designed to run from:
 *   - Cron endpoint (POST /api/cgm/cron)
 *   - Manual sync button (POST /api/cgm/connections/[id]/sync)
 *   - Initial post-OAuth sync (90 day backfill)
 */

import { createServiceClient } from '@/lib/supabase/server';
import {
  fetchEGVs,
  refreshAccessToken,
  egvToReading,
  DexcomAuthError,
} from '@/lib/cgm/dexcom-client';
import { encryptToken, decryptToken } from '@/lib/cgm/encryption';
import { detectPatterns } from '@/lib/cgm/pattern-detection';
import { filterByRange, rangePreset } from '@/lib/cgm/analytics';

export interface SyncOptions {
  connectionId: string;
  triggeredBy: 'cron' | 'manual' | 'initial' | 'webhook';
  /** For initial sync, default 90 days back. For incremental, since last_synced_at. */
  windowDays?: number;
}

export interface SyncResult {
  ok: boolean;
  readingsFetched: number;
  readingsInserted: number;
  patternsDetected: number;
  alertsCreated: number;
  oldestReading?: string;
  newestReading?: string;
  error?: string;
}

const MAX_WINDOW_DAYS = 90;

export async function syncConnection(opts: SyncOptions): Promise<SyncResult> {
  const supabase = createServiceClient();

  // 1. Load connection
  const { data: conn, error: connErr } = await supabase
    .from('cgm_connections')
    .select('*')
    .eq('id', opts.connectionId)
    .single();

  if (connErr || !conn) {
    return { ok: false, readingsFetched: 0, readingsInserted: 0, patternsDetected: 0, alertsCreated: 0, error: 'Connection not found' };
  }

  if (!conn.is_active || conn.deleted_at) {
    return { ok: false, readingsFetched: 0, readingsInserted: 0, patternsDetected: 0, alertsCreated: 0, error: 'Connection inactive' };
  }

  // 2. Open sync log entry
  const { data: syncRow } = await supabase
    .from('cgm_sync_log')
    .insert({
      connection_id: conn.id,
      patient_id: conn.patient_id,
      organization_id: conn.organization_id,
      triggered_by: opts.triggeredBy,
      status: 'running',
    })
    .select('id')
    .single();

  const syncId = syncRow?.id;

  // 3. Mark connection syncing
  await supabase
    .from('cgm_connections')
    .update({ sync_status: 'syncing' })
    .eq('id', conn.id);

  try {
    // 4. Determine window
    const end = new Date();
    let start: Date;
    if (opts.triggeredBy === 'initial') {
      start = new Date(end);
      start.setDate(start.getDate() - (opts.windowDays ?? MAX_WINDOW_DAYS));
    } else if (conn.last_synced_at) {
      start = new Date(conn.last_synced_at);
      // Cap to MAX_WINDOW_DAYS lookback in case sync has been idle long
      const maxStart = new Date(end);
      maxStart.setDate(maxStart.getDate() - MAX_WINDOW_DAYS);
      if (start < maxStart) start = maxStart;
    } else {
      start = new Date(end);
      start.setDate(start.getDate() - 14); // default first sync = 14 days
    }

    // 5. Refresh access token if near expiry
    let accessToken = decryptToken(conn.encrypted_access_token);
    const refreshToken = decryptToken(conn.encrypted_refresh_token);
    const expiresAt = conn.token_expires_at ? new Date(conn.token_expires_at) : null;
    const NEAR_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

    if (!expiresAt || expiresAt.getTime() - Date.now() < NEAR_EXPIRY_MS) {
      try {
        const refreshed = await refreshAccessToken(refreshToken);
        accessToken = refreshed.access_token;
        const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000);
        await supabase
          .from('cgm_connections')
          .update({
            encrypted_access_token: encryptToken(refreshed.access_token),
            encrypted_refresh_token: encryptToken(refreshed.refresh_token),
            token_expires_at: newExpiry.toISOString(),
          })
          .eq('id', conn.id);
      } catch (err) {
        throw new DexcomAuthError(`Token refresh failed: ${(err as Error).message}`);
      }
    }

    // 6. Fetch EGVs
    const egvResp = await fetchEGVs(accessToken, start, end);
    const fetched = egvResp.records.length;

    if (fetched === 0) {
      await finishSync(supabase, syncId, conn.id, 'success', { readingsFetched: 0, readingsInserted: 0 });
      return {
        ok: true,
        readingsFetched: 0,
        readingsInserted: 0,
        patternsDetected: 0,
        alertsCreated: 0,
      };
    }

    // 7. Insert readings (upsert to handle duplicates)
    const rows = egvResp.records.map((egv) =>
      egvToReading(egv, conn.patient_id, conn.organization_id, conn.id)
    );

    // Batch insert in chunks of 500 to avoid payload limits
    let inserted = 0;
    const CHUNK = 500;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK);
      const { data: insData, error: insErr } = await supabase
        .from('cgm_readings')
        .upsert(chunk, { onConflict: 'patient_id,recorded_at,connection_id', ignoreDuplicates: true })
        .select('id');
      if (insErr) {
        console.error('[cgm sync] insert chunk failed', insErr);
      } else if (insData) {
        inserted += insData.length;
      }
    }

    const sortedTimes = rows.map((r) => r.recorded_at).sort();
    const oldest = sortedTimes[0];
    const newest = sortedTimes[sortedTimes.length - 1];

    // 8. Run pattern detection over last 14 days (post-insert)
    const detectionWindow = rangePreset('14d');
    const { data: recent } = await supabase
      .from('cgm_readings')
      .select('recorded_at, glucose_mg_dl, trend')
      .eq('patient_id', conn.patient_id)
      .gte('recorded_at', detectionWindow.start.toISOString())
      .lte('recorded_at', detectionWindow.end.toISOString())
      .order('recorded_at', { ascending: true });

    const { data: thresholdsRow } = await supabase
      .from('cgm_thresholds')
      .select('*')
      .eq('patient_id', conn.patient_id)
      .single();

    const patterns = recent
      ? detectPatterns(recent as any, {
          thresholds: thresholdsRow
            ? {
                targetLow: Number(thresholdsRow.target_low),
                targetHigh: Number(thresholdsRow.target_high),
                urgentLow: Number(thresholdsRow.urgent_low),
                urgentHigh: Number(thresholdsRow.urgent_high),
              }
            : undefined,
          detectNocturnalHypo: thresholdsRow?.alert_nocturnal_hypo ?? true,
          detectPostprandialSpike: thresholdsRow?.alert_postprandial_spike ?? true,
          detectDawnPhenomenon: thresholdsRow?.alert_dawn_phenomenon ?? true,
          detectHighVariability: thresholdsRow?.alert_high_variability ?? true,
          cvThreshold: thresholdsRow ? Number(thresholdsRow.cv_threshold) : 36,
          rangeStart: detectionWindow.start,
          rangeEnd: detectionWindow.end,
        })
      : [];

    // 9. Persist alerts (dedupe: don't re-insert same type within last 24h)
    let alertsCreated = 0;
    if (patterns.length > 0) {
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: recentAlerts } = await supabase
        .from('cgm_alerts')
        .select('alert_type')
        .eq('patient_id', conn.patient_id)
        .is('resolved_at', null)
        .gte('detected_at', cutoff);

      const recentTypes = new Set((recentAlerts ?? []).map((a) => a.alert_type));

      const toInsert = patterns
        .filter((p) => !recentTypes.has(p.type))
        .map((p) => ({
          organization_id: conn.organization_id,
          patient_id: conn.patient_id,
          connection_id: conn.id,
          alert_type: p.type,
          severity: p.severity,
          title: p.title,
          description: p.description,
          observation_window_start: p.windowStart,
          observation_window_end: p.windowEnd,
          context: p.context,
        }));

      if (toInsert.length > 0) {
        const { data: insAlerts } = await supabase.from('cgm_alerts').insert(toInsert).select('id');
        alertsCreated = insAlerts?.length ?? 0;
      }
    }

    // 10. Update connection last_synced_at, reset error state
    await supabase
      .from('cgm_connections')
      .update({
        last_synced_at: end.toISOString(),
        sync_status: 'idle',
        last_error: null,
        last_error_at: null,
        consecutive_failures: 0,
      })
      .eq('id', conn.id);

    // 11. Close sync log
    await finishSync(supabase, syncId, conn.id, 'success', {
      readingsFetched: fetched,
      readingsInserted: inserted,
      oldestReading: oldest,
      newestReading: newest,
    });

    return {
      ok: true,
      readingsFetched: fetched,
      readingsInserted: inserted,
      patternsDetected: patterns.length,
      alertsCreated,
      oldestReading: oldest,
      newestReading: newest,
    };
  } catch (err) {
    const msg = (err as Error).message ?? 'Unknown error';
    console.error('[cgm sync] failed', opts.connectionId, msg);

    await supabase
      .from('cgm_connections')
      .update({
        sync_status: 'error',
        last_error: msg,
        last_error_at: new Date().toISOString(),
        consecutive_failures: (conn.consecutive_failures ?? 0) + 1,
      })
      .eq('id', conn.id);

    await finishSync(supabase, syncId, conn.id, 'error', { error: msg });

    return {
      ok: false,
      readingsFetched: 0,
      readingsInserted: 0,
      patternsDetected: 0,
      alertsCreated: 0,
      error: msg,
    };
  }
}

async function finishSync(
  supabase: ReturnType<typeof createServiceClient>,
  syncId: string | undefined,
  connectionId: string,
  status: 'success' | 'error' | 'partial',
  extra: { readingsFetched?: number; readingsInserted?: number; oldestReading?: string; newestReading?: string; error?: string }
) {
  if (!syncId) return;
  await supabase
    .from('cgm_sync_log')
    .update({
      completed_at: new Date().toISOString(),
      status,
      readings_fetched: extra.readingsFetched ?? 0,
      readings_inserted: extra.readingsInserted ?? 0,
      oldest_reading: extra.oldestReading ?? null,
      newest_reading: extra.newestReading ?? null,
      error_message: extra.error ?? null,
    })
    .eq('id', syncId);
}
