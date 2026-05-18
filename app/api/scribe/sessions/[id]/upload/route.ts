import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_AUDIO_BYTES = 200 * 1024 * 1024; // 200 MB
const ALLOWED_MIME = new Set([
  'audio/webm',
  'audio/mp4',
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
  'audio/x-m4a',
]);

/**
 * POST /api/scribe/sessions/[id]/upload
 * Multipart form with field 'audio'. Streams to Supabase Storage.
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { data: session } = await supabase
    .from('scribe_sessions')
    .select('id, organization_id, patient_id, provider_id, status')
    .eq('id', params.id)
    .is('deleted_at', null)
    .single();

  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  if (session.provider_id !== user.id) {
    return NextResponse.json({ error: 'Only the recording provider can upload' }, { status: 403 });
  }
  if (!['recording', 'uploading'].includes(session.status)) {
    return NextResponse.json({ error: `Cannot upload to session in status '${session.status}'` }, { status: 409 });
  }

  const formData = await request.formData();
  const file = formData.get('audio');
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: 'Missing audio file' }, { status: 400 });
  }

  const mime = file.type || 'audio/webm';
  if (!ALLOWED_MIME.has(mime)) {
    return NextResponse.json({ error: `Unsupported audio type: ${mime}` }, { status: 415 });
  }
  if (file.size > MAX_AUDIO_BYTES) {
    return NextResponse.json({ error: 'Audio file exceeds 200 MB' }, { status: 413 });
  }

  await supabase.from('scribe_sessions').update({ status: 'uploading' }).eq('id', session.id);

  const admin = createServiceClient();
  const ext = mime.split('/')[1].replace('mpeg', 'mp3').replace('x-m4a', 'm4a');
  const path = `${session.organization_id}/${session.id}.${ext}`;
  const arrayBuf = await file.arrayBuffer();

  const { error: uploadErr } = await admin.storage
    .from('scribe-audio')
    .upload(path, arrayBuf, { contentType: mime, upsert: true });

  if (uploadErr) {
    console.error('[scribe upload] storage failed', uploadErr);
    await supabase.from('scribe_sessions').update({ status: 'recording' }).eq('id', session.id);
    return NextResponse.json({ error: 'Upload failed', details: uploadErr.message }, { status: 500 });
  }

  await supabase
    .from('scribe_sessions')
    .update({
      status: 'uploaded',
      audio_storage_path: path,
      audio_mime_type: mime,
      audio_bytes: file.size,
    })
    .eq('id', session.id);

  await logAudit({
    organizationId: session.organization_id,
    userId: user.id,
    action: 'update',
    resourceType: 'scribe_session',
    resourceId: session.id,
    patientId: session.patient_id,
    metadata: { event: 'audio_uploaded', bytes: file.size, mime },
  });

  return NextResponse.json({ ok: true, path, bytes: file.size });
}
