import { createClient } from '@/lib/supabase/server';
import { formatDateTime } from '@/lib/utils';
import Link from 'next/link';
import { FileText } from 'lucide-react';

export const metadata = { title: 'Encounters' };

export default async function EncountersListPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const supabase = await createClient();
  const filter = searchParams.status;

  let q = supabase
    .from('encounters')
    .select(`
      id, encounter_type, status, chief_complaint,
      scheduled_at, started_at, signed_at, updated_at,
      patients(id, first_name, last_name, mrn),
      provider:users!encounters_provider_id_fkey(full_name, credentials)
    `)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .limit(50);

  if (filter === 'draft') q = q.in('status', ['draft', 'in_progress']);
  else if (filter === 'signed') q = q.eq('status', 'signed');

  const { data: encounters } = await q;

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl tracking-tight">Encounters</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {encounters?.length ?? 0} {filter ? `${filter} ` : ''}encounters
          </p>
        </div>
      </header>

      <div className="flex gap-2">
        <FilterPill href="/app/encounters" active={!filter}>All</FilterPill>
        <FilterPill href="/app/encounters?status=draft" active={filter === 'draft'}>Drafts</FilterPill>
        <FilterPill href="/app/encounters?status=signed" active={filter === 'signed'}>Signed</FilterPill>
      </div>

      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        {!encounters || encounters.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <FileText className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="font-display text-lg">No encounters {filter ? `(${filter})` : 'yet'}</p>
            <p className="text-sm text-muted-foreground mt-1">Start a new encounter from a patient&rsquo;s chart.</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {encounters.map((e: any) => (
              <li key={e.id}>
                <Link href={`/app/encounters/${e.id}`} className="block px-6 py-4 hover:bg-muted/30 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">
                          {e.patients?.last_name}, {e.patients?.first_name}
                        </span>
                        <span className="text-xs font-mono text-muted-foreground">MRN {e.patients?.mrn}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
                        <span className="capitalize">{e.encounter_type.replace(/_/g, ' ')}</span>
                        <span>·</span>
                        <span>{e.chief_complaint || 'No chief complaint'}</span>
                        <span>·</span>
                        <span>{formatDateTime(e.signed_at ?? e.started_at ?? e.updated_at)}</span>
                        {e.provider && (
                          <>
                            <span>·</span>
                            <span>{e.provider.full_name}{e.provider.credentials ? `, ${e.provider.credentials}` : ''}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <span className={`shrink-0 clinical-badge ${e.status === 'signed' ? 'clinical-badge-good' : 'clinical-badge-borderline'} capitalize`}>
                      {e.status.replace('_', ' ')}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function FilterPill({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} className={`px-4 h-9 inline-flex items-center rounded-full text-xs font-mono uppercase tracking-wider transition-colors ${active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground'}`}>
      {children}
    </Link>
  );
}
