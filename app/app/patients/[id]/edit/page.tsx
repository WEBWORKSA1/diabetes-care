import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Pencil } from 'lucide-react';
import { PatientForm } from '../../new/patient-form';

export const metadata = { title: 'Edit patient' };

export default async function EditPatientPage({ params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single();

  const [{ data: patient }, { data: providers }] = await Promise.all([
    supabase
      .from('patients')
      .select('*')
      .eq('id', params.id)
      .is('deleted_at', null)
      .single(),
    supabase
      .from('users')
      .select('id, full_name, credentials')
      .eq('organization_id', profile?.organization_id ?? '')
      .eq('is_active', true)
      .in('role', ['owner', 'provider'])
      .order('full_name'),
  ]);

  if (!patient) return notFound();

  return (
    <div className="max-w-3xl space-y-6">
      <Link href={`/app/patients/${patient.id}`} className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3 w-3" /> Back to patient
      </Link>
      <header className="space-y-2">
        <div className="inline-flex p-3 rounded-xl bg-primary/10 text-primary">
          <Pencil className="h-5 w-5" />
        </div>
        <h1 className="font-display text-3xl tracking-tight">Edit {patient.last_name}, {patient.first_name}</h1>
        <p className="text-sm text-muted-foreground font-mono">MRN {patient.mrn}</p>
      </header>
      <PatientForm
        mode="edit"
        initial={patient}
        patientId={patient.id}
        providers={(providers ?? []) as any}
        currentUserId={user.id}
      />
    </div>
  );
}
