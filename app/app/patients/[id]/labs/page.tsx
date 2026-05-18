import { createClient } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit';
import { notFound, redirect } from 'next/navigation';
import { calculateAge, diabetesTypeLabel } from '@/lib/utils';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { LabsView } from './labs-view';

export const metadata = { title: 'Labs' };

export default async function PatientLabsPage({ params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: patient, error }, { data: labs }] = await Promise.all([
    supabase
      .from('patients')
      .select('id, first_name, last_name, mrn, date_of_birth, sex_at_birth, diabetes_type, organization_id')
      .eq('id', params.id)
      .is('deleted_at', null)
      .single(),
    supabase
      .from('lab_values')
      .select('id, test_name, value, unit, reference_low, reference_high, is_abnormal, collected_at, notes')
      .eq('patient_id', params.id)
      .is('deleted_at', null)
      .order('collected_at', { ascending: false })
      .limit(500),
  ]);

  if (error || !patient) return notFound();

  await logAudit({
    organizationId: patient.organization_id,
    userId: user.id,
    action: 'read',
    resourceType: 'lab_values',
    patientId: patient.id,
    metadata: { count: labs?.length ?? 0 },
  });

  return (
    <div className="space-y-6">
      <Link
        href={`/app/patients/${patient.id}`}
        className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" /> Back to patient
      </Link>

      <header className="space-y-2">
        <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Lab results</div>
        <h1 className="font-display text-3xl tracking-tight">
          {patient.last_name}, {patient.first_name}
        </h1>
        <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
          <span className="font-mono">MRN {patient.mrn}</span>
          <span>·</span>
          <span>{calculateAge(patient.date_of_birth)} yrs</span>
          <span>·</span>
          <span className="capitalize">{patient.sex_at_birth}</span>
          <span>·</span>
          <span>{diabetesTypeLabel(patient.diabetes_type)}</span>
        </div>
      </header>

      <LabsView
        labs={(labs ?? []) as any}
        patientName={`${patient.last_name}, ${patient.first_name}`}
        patientMrn={patient.mrn}
      />
    </div>
  );
}
