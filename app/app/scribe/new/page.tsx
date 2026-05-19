import { createClient } from '@/lib/supabase/server';
import { notFound, redirect } from 'next/navigation';
import { RecordingFlow } from './recording-flow';

export const metadata = { title: 'AI Scribe' };

export default async function NewScribeSessionPage({
  searchParams,
}: {
  searchParams: { patient?: string; encounter?: string };
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const patientId = searchParams.patient;
  if (!patientId) {
    return (
      <div className="max-w-md mx-auto py-16 text-center space-y-3">
        <p className="font-display text-xl">Select a patient first</p>
        <p className="text-sm text-muted-foreground">Start an AI Scribe session from a patient&rsquo;s chart.</p>
      </div>
    );
  }

  const { data: patient } = await supabase
    .from('patients')
    .select('id, first_name, last_name, mrn, date_of_birth, diabetes_type')
    .eq('id', patientId)
    .is('deleted_at', null)
    .single();

  if (!patient) return notFound();

  return <RecordingFlow patient={patient} existingEncounterId={searchParams.encounter} />;
}
