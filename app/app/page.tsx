import { createClient } from '@/lib/supabase/server';
import { formatDateTime } from '@/lib/utils';
import { Calendar, Users, FileText, Activity } from 'lucide-react';
import Link from 'next/link';
import { OnboardingChecklist } from '@/components/app/onboarding-checklist';

export const metadata = { title: 'Dashboard' };

export default async function DashboardPage() {
  const supabase = await createClient();

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const [
    { count: patientCount },
    { count: weekAppts },
    { count: pendingNotes },
    { count: activeAlerts },
    { data: todayAppts },
    { data: recentEncounters },
  ] = await Promise.all([
    supabase.from('patients').select('*', { count: 'exact', head: true }).is('deleted_at', null),
    supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .gte('starts_at', todayStart.toISOString())
      .lt('starts_at', new Date(todayStart.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString())
      .is('deleted_at', null),
    supabase
      .from('encounters')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'in_progress')
      .is('deleted_at', null),
    supabase
      .from('cgm_alerts')
      .select('*', { count: 'exact', head: true })
      .is('resolved_at', null),
    supabase
      .from('appointments')
      .select('id, starts_at, ends_at, appointment_type, reason, status, patients(id, first_name, last_name, mrn)')
      .gte('starts_at', todayStart.toISOString())
      .lte('starts_at', todayEnd.toISOString())
      .is('deleted_at', null)
      .order('starts_at', { ascending: true })
      .limit(8),
    supabase
      .from('encounters')
      .select('id, encounter_type, status, signed_at, patients(id, first_name, last_name)')
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
      .limit(5),
  ]);

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="font-display text-3xl tracking-tight">Today</h1>
        <p className="text-sm text-muted-foreground">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </header>

      <OnboardingChecklist />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Users} label="Active patients" value={patientCount ?? 0} href="/app/patients" />
        <StatCard icon={Calendar} label="Appointments this week" value={weekAppts ?? 0} href="/app/schedule" />
        <StatCard icon={FileText} label="Notes in progress" value={pendingNotes ?? 0} href="/app/encounters?status=in_progress" />
        <StatCard icon={Activity} label="CGM alerts" value={activeAlerts ?? 0} href="/app/cgm" tone="accent" />
      </div>

      <section className="bg-card rounded-2xl border border-border">
        <header className="flex items-center justify-between px-6 py-5 border-b border-border">
          <h2 className="font-display text-xl">Today&rsquo;s schedule</h2>
          <Link href="/app/schedule" className="text-xs font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground">View all →</Link>
        </header>
        {(!todayAppts || todayAppts.length === 0) ? (
          <EmptyState title="No appointments scheduled today" cta={{ label: 'Open schedule', href: '/app/schedule' }} />
        ) : (
          <ul className="divide-y divide-border">
            {todayAppts.map((a: any) => (
              <li key={a.id} className="px-6 py-4 flex items-center justify-between gap-4 hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="font-mono text-sm tabular-nums w-16">
                    {new Date(a.starts_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                  </div>
                  <div>
                    <Link href={`/app/schedule/${a.id}`} className="font-medium hover:text-accent">
                      {a.patients?.first_name} {a.patients?.last_name}
                    </Link>
                    <div className="text-xs text-muted-foreground">MRN {a.patients?.mrn} · {a.reason ?? a.appointment_type?.replace(/_/g, ' ')}</div>
                  </div>
                </div>
                <span className="clinical-badge clinical-badge-good capitalize">{a.status?.replace('_', ' ')}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="bg-card rounded-2xl border border-border">
        <header className="flex items-center justify-between px-6 py-5 border-b border-border">
          <h2 className="font-display text-xl">Recent encounters</h2>
          <Link href="/app/encounters" className="text-xs font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground">View all →</Link>
        </header>
        {(!recentEncounters || recentEncounters.length === 0) ? (
          <EmptyState title="No encounters yet" subtitle="Encounters will appear here once you start charting." />
        ) : (
          <ul className="divide-y divide-border">
            {recentEncounters.map((e: any) => (
              <li key={e.id} className="px-6 py-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                <div>
                  <div className="font-medium capitalize">{e.encounter_type.replace('_', ' ')}</div>
                  <div className="text-xs text-muted-foreground">{e.patients?.first_name} {e.patients?.last_name} · {formatDateTime(e.signed_at)}</div>
                </div>
                <span className={`clinical-badge ${e.status === 'signed' ? 'clinical-badge-good' : 'clinical-badge-borderline'} capitalize`}>{e.status?.replace('_', ' ')}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, href, tone = 'default' }: { icon: any; label: string; value: number | string; href: string; tone?: 'default' | 'accent' }) {
  return (
    <Link href={href} className="bg-card rounded-2xl border border-border p-5 hover:border-foreground/30 transition-colors group">
      <div className="flex items-center justify-between mb-3">
        <div className={`p-2 rounded-lg ${tone === 'accent' ? 'bg-accent/10 text-accent' : 'bg-muted text-muted-foreground'}`}>
          <Icon className="h-4 w-4" />
        </div>
        <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground group-hover:text-foreground transition-colors">→</span>
      </div>
      <div className="font-display text-3xl tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
    </Link>
  );
}

function EmptyState({ title, subtitle, cta }: { title: string; subtitle?: string; cta?: { label: string; href: string } }) {
  return (
    <div className="px-6 py-12 text-center">
      <p className="font-display text-lg">{title}</p>
      {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      {cta && (
        <Link href={cta.href} className="inline-block mt-4 text-sm font-medium underline-offset-4 hover:underline">{cta.label} →</Link>
      )}
    </div>
  );
}
