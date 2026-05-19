import { createClient } from '@/lib/supabase/server';
import { notFound, redirect } from 'next/navigation';
import { logAudit } from '@/lib/audit';
import { DraftReview } from './draft-review';

export const metadata = { title: 'Scribe draft' };

export default async function ScribeSessionPage({ params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: session, error } = await supabase
    .from('scribe_sessions')
    .select(`
      *,
      patients(id, first_name, last_name, mrn, date_of_birth, sex_at_birth, diabetes_type),
      provider:users!scribe_sessions_provider_id_fkey(id, full_name, credentials)
    `)
    .eq('id', params.id)
    .is('deleted_at', null)
    .single();

  if (error || !session) return notFound();

  // Load latest draft for this session
  const { data: drafts } = await supabase
    .from('scribe_drafts')
    .select('*')
    .eq('session_id', session.id)
    .order('generated_at', { ascending: false });

  await logAudit({
    organizationId: session.organization_id,
    userId: user.id,
    action: 'read',
    resourceType: 'scribe_session',
    resourceId: session.id,
    patientId: session.patient_id,
  });

  return (
    <DraftReview
      session={session as any}
      drafts={(drafts ?? []) as any}
      currentUserId={user.id}
    />
  );
}
