import { createClient } from '@/lib/supabase/server';
import { notFound, redirect } from 'next/navigation';
import { TemplatePicker } from './template-picker';

export const metadata = { title: 'New encounter' };

export default async function NewEncounterPage({
  searchParams,
}: {
  searchParams: { patient?: string };
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const patientId = searchParams.patient;
  if (!patientId) {
    return (
      <div className="max-w-md mx-auto py-16 text-center space-y-3">
        <p className="font-display text-xl">Select a patient first</p>
        <p className="text-sm text-muted-foreground">
          Start a new encounter from the patient&rsquo;s chart.
        </p>
      </div>
    );
  }

  const { data: patient } = await supabase
    .from('patients')
    .select('id, first_name, last_name, mrn, diabetes_type')
    .eq('id', patientId)
    .is('deleted_at', null)
    .single();

  if (!patient) return notFound();

  const { data: templates } = await supabase
    .from('soap_templates')
    .select('id, slug, name, description, applies_to, encounter_types, is_system')
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('is_system', { ascending: false });

  const relevant = (templates ?? []).filter((t) =>
    !t.applies_to?.length || t.applies_to.includes(patient.diabetes_type)
  );

  return <TemplatePicker patient={patient} templates={relevant} />;
}
