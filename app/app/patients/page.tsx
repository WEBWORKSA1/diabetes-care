import { createClient } from '@/lib/supabase/server';
import { calculateAge, diabetesTypeLabel, formatDate } from '@/lib/utils';
import Link from 'next/link';
import { Plus, Search } from 'lucide-react';

export const metadata = { title: 'Patients' };

export default async function PatientsPage({ searchParams }: { searchParams: { q?: string } }) {
  const supabase = await createClient();
  const query = searchParams.q?.trim() ?? '';

  let queryBuilder = supabase
    .from('patients')
    .select(`id, mrn, first_name, last_name, date_of_birth, sex_at_birth, diabetes_type, diagnosis_date, is_active, updated_at`)
    .is('deleted_at', null)
    .order('last_name', { ascending: true });

  if (query) {
    queryBuilder = queryBuilder.or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,mrn.ilike.%${query}%`);
  }

  const { data: patients } = await queryBuilder.limit(100);

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl tracking-tight">Patients</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {patients?.length ?? 0} {patients?.length === 1 ? 'patient' : 'patients'}{query && ` matching "${query}"`}
          </p>
        </div>
        <Link href="/app/patients/new" className="inline-flex items-center gap-2 h-10 px-5 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-accent transition-colors">
          <Plus className="h-4 w-4" />
          New patient
        </Link>
      </header>

      <form className="relative max-w-md">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input name="q" defaultValue={query} placeholder="Search by name or MRN…"
          className="w-full h-11 pl-11 pr-4 rounded-full border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
      </form>

      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        {!patients || patients.length === 0 ? (
          <div className="px-6 py-16 text-center">
            {query ? (
              <>
                <p className="font-display text-lg">No patients found</p>
                <p className="text-sm text-muted-foreground mt-1">Try a different search term.</p>
              </>
            ) : (
              <>
                <p className="font-display text-lg">No patients yet</p>
                <p className="text-sm text-muted-foreground mt-1">Add your first patient to get started.</p>
                <Link href="/app/patients/new" className="inline-flex items-center gap-2 mt-6 h-10 px-5 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-accent transition-colors">
                  <Plus className="h-4 w-4" />
                  Add first patient
                </Link>
              </>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr className="text-left font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="px-6 py-3 font-medium">Patient</th>
                <th className="px-6 py-3 font-medium">MRN</th>
                <th className="px-6 py-3 font-medium">Age</th>
                <th className="px-6 py-3 font-medium">Type</th>
                <th className="px-6 py-3 font-medium">Diagnosed</th>
                <th className="px-6 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {patients.map((p) => (
                <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-6 py-4">
                    <Link href={`/app/patients/${p.id}`} className="font-medium hover:text-accent">
                      {p.last_name}, {p.first_name}
                    </Link>
                    <div className="text-xs text-muted-foreground capitalize mt-0.5">{p.sex_at_birth}</div>
                  </td>
                  <td className="px-6 py-4 font-mono text-xs text-muted-foreground">{p.mrn}</td>
                  <td className="px-6 py-4 tabular-nums">{calculateAge(p.date_of_birth)}</td>
                  <td className="px-6 py-4">{diabetesTypeLabel(p.diabetes_type)}</td>
                  <td className="px-6 py-4 text-muted-foreground">{formatDate(p.diagnosis_date)}</td>
                  <td className="px-6 py-4">
                    <span className={`clinical-badge ${p.is_active ? 'clinical-badge-good' : 'clinical-badge-borderline'}`}>
                      {p.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
