import { createClient } from '@/lib/supabase/server';
import { notFound, redirect } from 'next/navigation';
import { logAudit } from '@/lib/audit';
import { EncounterEditor } from './editor';

export const metadata = { title: 'Encounter' };

export default async function EncounterPage({ params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: encounter, error } = await supabase
    .from('encounters')
    .select(`
      *,
      patients(id, first_name, last_name, mrn, date_of_birth, sex_at_birth, diabetes_type, diagnosis_date),
      provider:users!encounters_provider_id_fkey(id, full_name, credentials)
    `)
    .eq('id', params.id)
    .is('deleted_at', null)
    .single();

  if (error || !encounter) return notFound();

  const [{ data: labs }, { data: meds }] = await Promise.all([
    supabase
      .from('lab_values')
      .select('id, test_name, value, unit, reference_low, reference_high, is_abnormal, collected_at')
      .eq('patient_id', encounter.patient_id)
      .is('deleted_at', null)
      .order('collected_at', { ascending: false })
      .limit(20),
    supabase
      .from('medications')
      .select('id, name, brand_name, dose, route, frequency, is_diabetes_med, indication, discontinued_at')
      .eq('patient_id', encounter.patient_id)
      .is('deleted_at', null)
      .order('is_diabetes_med', { ascending: false })
      .order('prescribed_at', { ascending: false }),
  ]);

  await logAudit({
    organizationId: encounter.organization_id,
    userId: user.id,
    action: 'read',
    resourceType: 'encounter',
    resourceId: encounter.id,
    patientId: encounter.patient_id,
  });

  return (
    <EncounterEditor
      encounter={encounter as any}
      labs={labs ?? []}
      medications={meds ?? []}
      currentUserId={user.id}
    />
  );
}
