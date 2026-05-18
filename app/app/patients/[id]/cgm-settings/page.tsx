import { createClient } from '@/lib/supabase/server';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { ThresholdSettingsForm } from '@/components/cgm/threshold-settings-form';
import { diabetesTypeLabel } from '@/lib/utils';

export const metadata = { title: 'CGM Settings' };

export default async function PatientCgmSettingsPage({ params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: patient }, { data: thresholds }] = await Promise.all([
    supabase
      .from('patients')
      .select('id, first_name, last_name, mrn, diabetes_type')
      .eq('id', params.id)
      .is('deleted_at', null)
      .single(),
    supabase
      .from('cgm_thresholds')
      .select('*')
      .eq('patient_id', params.id)
      .maybeSingle(),
  ]);

  if (!patient) return notFound();

  return (
    <div className="space-y-6">
      <Link
        href={`/app/patients/${patient.id}`}
        className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" /> Back to patient
      </Link>

      <header className="space-y-2">
        <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">CGM thresholds</div>
        <h1 className="font-display text-3xl tracking-tight">
          {patient.last_name}, {patient.first_name}
        </h1>
        <p className="text-sm text-muted-foreground">
          MRN {patient.mrn} · {diabetesTypeLabel(patient.diabetes_type)}
        </p>
      </header>

      <ThresholdSettingsForm patientId={patient.id} initial={thresholds as any} />
    </div>
  );
}
