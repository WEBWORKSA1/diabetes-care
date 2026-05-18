import { NextResponse, type NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { syncConnection } from '@/lib/cgm/sync-worker';

export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * GET /api/cgm/cron
 * Vercel cron entry. Configured in vercel.json to run hourly.
 * Authenticated by CRON_SECRET header.
 *
 * Iterates active connections and runs sync. Limits concurrency to 5 to avoid
 * blowing past Dexcom rate limits or Vercel function duration.
 */
export async function GET(request: NextRequest) {
  // Vercel cron sets this header automatically when CRON_SECRET is in env
  const auth = request.headers.get('authorization');
  const expectedSecret = process.env.CRON_SECRET;
  if (!expectedSecret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }
  if (auth !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createServiceClient();

  // Get connections that haven't synced in last 50 min and aren't currently syncing or in error backoff
  const cutoff = new Date(Date.now() - 50 * 60 * 1000).toISOString();
  const { data: conns, error } = await admin
    .from('cgm_connections')
    .select('id, consecutive_failures, last_synced_at')
    .eq('is_active', true)
    .neq('sync_status', 'syncing')
    .is('deleted_at', null)
    .or(`last_synced_at.is.null,last_synced_at.lt.${cutoff}`)
    .lt('consecutive_failures', 10) // back off after 10 failures
    .limit(200);

  if (error) {
    console.error('[cron] fetch connections failed', error);
    return NextResponse.json({ error: 'fetch_failed' }, { status: 500 });
  }

  const list = conns ?? [];
  if (list.length === 0) {
    return NextResponse.json({ ok: true, message: 'No connections to sync', count: 0 });
  }

  // Cleanup expired OAuth states opportunistically
  await admin.rpc('cleanup_expired_oauth_states').catch(() => {});

  // Run with bounded concurrency
  const CONCURRENCY = 5;
  const results: Array<{ id: string; ok: boolean; error?: string }> = [];

  for (let i = 0; i < list.length; i += CONCURRENCY) {
    const batch = list.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map(async (c) => {
        const r = await syncConnection({ connectionId: c.id, triggeredBy: 'cron' });
        return { id: c.id, ok: r.ok, error: r.error };
      })
    );
    results.push(...batchResults);
  }

  const success = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;

  return NextResponse.json({
    ok: true,
    total: list.length,
    success,
    failed,
    results,
  });
}
