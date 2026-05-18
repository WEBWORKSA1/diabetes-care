import { NextResponse, type NextRequest } from 'next/server';
import { syncAllDueConnections } from '@/lib/cgm/sync-engine';

export async function POST(request: NextRequest) {
  const auth = request.headers.get('authorization') ?? '';
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 503 });
  }
  if (auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startedAt = new Date().toISOString();
  const results = await syncAllDueConnections(100);

  const summary = {
    started_at: startedAt,
    completed_at: new Date().toISOString(),
    connections_processed: results.length,
    total_readings_synced: results.reduce((s, r) => s + r.readings_inserted, 0),
    total_patterns_detected: results.reduce((s, r) => s + r.patterns_detected, 0),
    errors: results.filter((r) => r.error).length,
    results,
  };

  return NextResponse.json(summary);
}

export const runtime = 'nodejs';
export const maxDuration = 300;
