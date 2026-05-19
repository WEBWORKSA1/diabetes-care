import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Mic, FileText, ChevronRight } from 'lucide-react';
import { formatDateTime } from '@/lib/utils';

export const metadata = { title: 'AI Scribe' };

export default async function ScribeIndexPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: sessions } = await supabase
    .from('scribe_sessions')
    .select(`
      id, status, started_at, completed_at, duration_seconds,
      patients(id, first_name, last_name, mrn)
    `)
    .is('deleted_at', null)
    .order('started_at', { ascending: false })
    .limit(50);

  const list = (sessions ?? []) as any[];

  return (
    <div className="space-y-8">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl tracking-tight">AI Scribe</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Record an encounter, get a SOAP draft.
          </p>
        </div>
        <Link
          href="/app/scribe/settings"
          className="text-xs font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground"
        >
          Settings →
        </Link>
      </header>

      <section className="bg-card rounded-2xl border border-border">
        <header className="px-6 py-5 border-b border-border flex items-center justify-between">
          <h2 className="font-display text-xl flex items-center gap-2">
            <Mic className="h-4 w-4" /> Recent sessions
          </h2>
          <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">{list.length} total</span>
        </header>
        {list.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <Mic className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="font-display text-lg">No sessions yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Start a new AI Scribe session from a patient&rsquo;s chart.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {list.map((s) => (
              <li key={s.id}>
                <Link href={`/app/scribe/sessions/${s.id}`} className="block px-6 py-4 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{s.patients?.last_name}, {s.patients?.first_name}</span>
                        <span className="text-xs font-mono text-muted-foreground">MRN {s.patients?.mrn}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
                        <span>{formatDateTime(s.started_at)}</span>
                        {s.duration_seconds && (
                          <>
                            <span>·</span>
                            <span>{Math.floor(s.duration_seconds / 60)}:{String(Math.floor(s.duration_seconds % 60)).padStart(2, '0')}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <StatusBadge status={s.status} />
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone = ['accepted'].includes(status) ? 'good' :
               ['rejected', 'transcription_failed', 'generation_failed', 'expired'].includes(status) ? 'high' :
               ['ready'].includes(status) ? 'borderline' : 'borderline';
  return (
    <span className={`shrink-0 clinical-badge clinical-badge-${tone} capitalize`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}
