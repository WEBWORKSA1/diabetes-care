import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { transcribeAudio } from '@/lib/scribe/transcribe';
import { logAudit } from '@/lib/audit';

export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * POST /api/scribe/sessions/[id]/transcribe
 * Downloads audio from storage, runs Whisper, persists transcript + segments.
 */
export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { data: session } = await supabase
    .from('scribe_sessions')
    .select('id, organization_id, patient_id, provider_id, status, audio_storage_path, audio_mime_type')
    .eq('id', params.id)
    .is('deleted_at', null)
    .single();

  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  if (!session.audio_storage_path) return NextResponse.json({ error: 'No audio uploaded' }, { status: 409 });
  if (!['uploaded', 'transcription_failed'].includes(session.status)) {
    return NextResponse.json({ error: `Cannot transcribe session in status '${session.status}'` }, { status: 409 });
  }

  await supabase.from('scribe_sessions').update({ status: 'transcribing' }).eq('id', session.id);

  const admin = createServiceClient();
  const { data: audioFile, error: dlErr } = await admin.storage
    .from('scribe-audio')
    .download(session.audio_storage_path);

  if (dlErr || !audioFile) {
    await supabase
      .from('scribe_sessions')
      .update({ status: 'transcription_failed', transcription_error: 'audio_download_failed' })
      .eq('id', session.id);
    return NextResponse.json({ error: 'Could not download audio' }, { status: 500 });
  }

  try {
    const result = await transcribeAudio(audioFile, `session-${session.id}.${(session.audio_mime_type ?? 'audio/webm').split('/')[1]}`);

    await supabase
      .from('scribe_sessions')
      .update({
        status: 'transcribed',
        transcript_text: result.text,
        transcript_segments: result.segments,
        transcription_model: result.model,
        transcription_completed_at: new Date().toISOString(),
        duration_seconds: result.duration_seconds,
        transcription_error: null,
      })
      .eq('id', session.id);

    await logAudit({
      organizationId: session.organization_id,
      userId: user.id,
      action: 'update',
      resourceType: 'scribe_session',
      resourceId: session.id,
      patientId: session.patient_id,
      metadata: {
        event: 'transcribed',
        duration_seconds: result.duration_seconds,
        segments: result.segments.length,
      },
    });

    return NextResponse.json({
      ok: true,
      duration_seconds: result.duration_seconds,
      segment_count: result.segments.length,
    });
  } catch (err) {
    const msg = (err as Error).message;
    console.error('[scribe transcribe] failed', msg);
    await supabase
      .from('scribe_sessions')
      .update({ status: 'transcription_failed', transcription_error: msg })
      .eq('id', session.id);
    return NextResponse.json({ error: 'Transcription failed', details: msg }, { status: 500 });
  }
}
