import { createClient } from '@/lib/supabase/server';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { ConnectFlow } from './connect-flow';
import { diabetesTypeLabel } from '@/lib/utils';

export const metadata = { title: 'Connect CGM' };

export default async function CgmConnectPage({
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
        <p className="text-sm text-muted-foreground">Connect CGM from a patient&rsquo;s chart.</p>
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

  return (
    <div className="max-w-xl space-y-8">
      <Link
        href={`/app/patients/${patient.id}`}
        className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" /> Back to patient
      </Link>

      <header className="space-y-2">
        <h1 className="font-display text-3xl tracking-tight">Connect CGM</h1>
        <p className="text-sm text-muted-foreground">
          For <strong className="text-foreground">{patient.last_name}, {patient.first_name}</strong>{' '}
          (MRN {patient.mrn} · {diabetesTypeLabel(patient.diabetes_type)})
        </p>
      </header>

      <ConnectFlow patient={patient} />
    </div>
  );
}
