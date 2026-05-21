import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus } from 'lucide-react';
import { LabsView } from './labs-view';
import type { LabRow } from '@/lib/clinical/lab-analytics';

export const metadata = { title: 'Labs' };

export default async function PatientLabsPage({ params }: { params: { id: string } }) {
  const supabase = await createClient();

  const [{ data: patient }, { data: labs }] = await Promise.all([
    supabase
      .from('patients')
      .select('id, first_name, last_name, mrn')
      .eq('id', params.id)
      .is('deleted_at', null)
      .single(),
    supabase
      .from('lab_values')
      .select('id, test_name, value, unit, collected_at, reference_low, reference_high, source')
      .eq('patient_id', params.id)
      .is('deleted_at', null)
      .order('collected_at', { ascending: false })
      .limit(500),
  ]);

  if (!patient) return notFound();

  // Compute is_abnormal flag for each lab
  const rows: LabRow[] = (labs ?? []).map((l: any) => ({
    id: l.id,
    test_name: l.test_name,
    value: Number(l.value),
    unit: l.unit,
    collected_at: l.collected_at,
    reference_low: l.reference_low !== null ? Number(l.reference_low) : null,
    reference_high: l.reference_high !== null ? Number(l.reference_high) : null,
    source: l.source,
    is_abnormal:
      l.reference_low !== null && l.reference_high !== null
        ? Number(l.value) < Number(l.reference_low) || Number(l.value) > Number(l.reference_high)
        : null,
  }));

  const patientName = `${patient.first_name} ${patient.last_name}`;

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
        <h1 className="font-display text-3xl tracking-tight">{patient.last_name}, {patient.first_name}</h1>
        <p className="text-sm text-muted-foreground font-mono">MRN {patient.mrn}</p>
      </header>
      <LabsView labs={rows} patientId={patient.id} patientName={patientName} patientMrn={patient.mrn} />
    </div>
  );
}
