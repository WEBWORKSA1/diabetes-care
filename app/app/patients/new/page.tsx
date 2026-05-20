import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, UserPlus } from 'lucide-react';
import { PatientForm } from './patient-form';

export const metadata = { title: 'Add patient' };

export default async function NewPatientPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single();

  // Load providers in this org for primary provider picker
  const { data: providers } = await supabase
    .from('users')
    .select('id, full_name, credentials')
    .eq('organization_id', profile?.organization_id ?? '')
    .eq('is_active', true)
    .in('role', ['owner', 'provider'])
    .order('full_name');

  // Suggest next MRN based on count
  const { count } = await supabase
    .from('patients')
    .select('id', { count: 'exact', head: true });
  const suggestedMrn = String((count ?? 0) + 1).padStart(4, '0');

  return (
    <div className="max-w-3xl space-y-6">
      <Link href="/app/patients" className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3 w-3" /> All patients
      </Link>
      <header className="space-y-2">
        <div className="inline-flex p-3 rounded-xl bg-primary/10 text-primary">
          <UserPlus className="h-5 w-5" />
        </div>
        <h1 className="font-display text-3xl tracking-tight">Add patient</h1>
        <p className="text-sm text-muted-foreground">
          Capture only what you need for the first visit. The rest can be filled in later.
        </p>
      </header>
      <PatientForm
        mode="create"
        providers={(providers ?? []) as any}
        currentUserId={user.id}
        suggestedMrn={suggestedMrn}
      />
    </div>
  );
}
