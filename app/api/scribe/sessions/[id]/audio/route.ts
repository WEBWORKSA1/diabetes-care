import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit';

export const runtime = 'nodejs';

/**
 * GET /api/scribe/sessions/[id]/audio
 * Streams a signed-URL redirect for the session's audio to authenticated users in the same org.
 * Signed URLs are short-lived (5 min).
 */
export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { data: session } = await supabase
    .from('scribe_sessions')
    .select('id, organization_id, patient_id, audio_storage_path, status')
    .eq('id', params.id)
    .is('deleted_at', null)
    .single();

  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!session.audio_storage_path || session.status === 'expired') {
    return NextResponse.json({ error: 'Audio not available' }, { status: 404 });
  }

  const admin = createServiceClient();
  const { data, error } = await admin.storage
    .from('scribe-audio')
    .createSignedUrl(session.audio_storage_path, 300);

  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: 'Could not generate audio URL' }, { status: 500 });
  }

  await logAudit({
    organizationId: session.organization_id,
    userId: user.id,
    action: 'read',
    resourceType: 'scribe_audio',
    resourceId: session.id,
    patientId: session.patient_id,
  });

  return NextResponse.json({ url: data.signedUrl, expires_in: 300 });
}
