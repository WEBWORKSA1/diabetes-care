import { NextResponse, type NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * GET /api/scribe/cron
 * Hourly cron: purge expired audio from storage + mark sessions expired.
 * Auth: Bearer CRON_SECRET (same secret used by CGM cron).
 */
export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization');
  const expectedSecret = process.env.CRON_SECRET;
  if (!expectedSecret) return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  if (auth !== `Bearer ${expectedSecret}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createServiceClient();

  // Find sessions where audio is past retention but storage object still present
  const now = new Date().toISOString();
  const { data: expired } = await admin
    .from('scribe_sessions')
    .select('id, organization_id, audio_storage_path')
    .lt('expires_at', now)
    .not('audio_storage_path', 'is', null)
    .neq('status', 'expired')
    .is('deleted_at', null)
    .limit(500);

  let purgedFiles = 0;
  let purgedSessions = 0;

  for (const s of expired ?? []) {
    if (s.audio_storage_path) {
      const { error } = await admin.storage.from('scribe-audio').remove([s.audio_storage_path]);
      if (!error) purgedFiles++;
    }
    await admin
      .from('scribe_sessions')
      .update({ status: 'expired', audio_storage_path: null })
      .eq('id', s.id);
    purgedSessions++;
  }

  return NextResponse.json({
    ok: true,
    purged_files: purgedFiles,
    purged_sessions: purgedSessions,
  });
}
