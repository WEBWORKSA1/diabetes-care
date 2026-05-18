import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Activity, AlertTriangle, ChevronRight, RefreshCw } from 'lucide-react';
import { formatDateTime } from '@/lib/utils';

export const metadata = { title: 'CGM' };

export default async function CgmIndexPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: connections }, { data: alerts }] = await Promise.all([
    supabase
      .from('cgm_connections')
      .select(`
        id, device, last_synced_at, sync_status, last_error, consecutive_failures, is_active,
        patients(id, first_name, last_name, mrn)
      `)
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('last_synced_at', { ascending: false, nullsFirst: true })
      .limit(100),
    supabase
      .from('cgm_alerts')
      .select(`
        id, alert_type, severity, title, detected_at,
        patients(id, first_name, last_name)
      `)
      .is('resolved_at', null)
      .order('severity', { ascending: false })
      .order('detected_at', { ascending: false })
      .limit(50),
  ]);

  const conns = (connections ?? []) as any[];
  const al = (alerts ?? []) as any[];

  return (
    <div className="space-y-8">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl tracking-tight">CGM</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {conns.length} active connection{conns.length === 1 ? '' : 's'} · {al.length} unresolved alert{al.length === 1 ? '' : 's'}
          </p>
        </div>
      </header>

      {al.length > 0 && (
        <section className="bg-card rounded-2xl border border-border">
          <header className="px-6 py-5 border-b border-border">
            <h2 className="font-display text-xl flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" /> Active alerts across all patients
            </h2>
          </header>
          <ul className="divide-y divide-border">
            {al.slice(0, 10).map((a) => (
              <li key={a.id}>
                <Link href={`/app/patients/${a.patients?.id}`} className="block px-6 py-4 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded ${
                          a.severity === 'critical' ? 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-100' :
                          a.severity === 'warning' ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100' :
                          'bg-muted text-muted-foreground'
                        }`}>
                          {a.severity}
                        </span>
                        <span className="font-medium text-sm">{a.title}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {a.patients?.last_name}, {a.patients?.first_name} · {formatDateTime(a.detected_at)}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          {al.length > 10 && (
            <div className="px-6 py-3 border-t border-border text-xs text-muted-foreground text-center">
              {al.length - 10} more alerts. Open each patient to review.
            </div>
          )}
        </section>
      )}

      <section className="bg-card rounded-2xl border border-border">
        <header className="px-6 py-5 border-b border-border">
          <h2 className="font-display text-xl flex items-center gap-2">
            <Activity className="h-4 w-4" /> Connected CGMs
          </h2>
        </header>
        {conns.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <Activity className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="font-display text-lg">No CGMs connected yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Open a patient&rsquo;s chart and use the Connect CGM button to authorize their device.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {conns.map((c) => (
              <li key={c.id}>
                <Link href={`/app/patients/${c.patients?.id}`} className="block px-6 py-4 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{c.patients?.last_name}, {c.patients?.first_name}</span>
                        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                          MRN {c.patients?.mrn} · {c.device.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
                        <RefreshCw className="h-3 w-3" />
                        Last sync: {c.last_synced_at ? formatDateTime(c.last_synced_at) : 'Never'}
                        {c.sync_status === 'error' && (
                          <span className="text-destructive">· Sync error</span>
                        )}
                        {c.consecutive_failures > 0 && c.consecutive_failures < 10 && (
                          <span className="text-amber-600">· {c.consecutive_failures} failure{c.consecutive_failures === 1 ? '' : 's'}</span>
                        )}
                        {c.consecutive_failures >= 10 && (
                          <span className="text-destructive">· Backoff, needs re-auth</span>
                        )}
                      </div>
                    </div>
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
