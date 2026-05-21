import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Inbox, Calendar, Users } from 'lucide-react';
import { InboxView } from '@/components/inbox/inbox-view';
import { OnboardingChecklist } from '@/components/app/onboarding-checklist';
import { formatDateTime } from '@/lib/utils';

export const metadata = { title: 'Today' };

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('users')
    .select('id, full_name, role, organization_id, inbox_filter_default, inbox_layout')
    .eq('id', user.id)
    .single();
  if (!profile) redirect('/login');

  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);

  const { data: todayAppts } = await supabase
    .from('appointments')
    .select('id, starts_at, ends_at, appointment_type, reason, status, patients(id, first_name, last_name, mrn), provider:users!appointments_provider_id_fkey(id, full_name)')
    .gte('starts_at', todayStart.toISOString())
    .lte('starts_at', todayEnd.toISOString())
    .is('deleted_at', null)
    .order('starts_at', { ascending: true })
    .limit(20);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();
  const firstName = profile.full_name?.split(' ')[0] ?? '';

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <p className="text-sm text-muted-foreground">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
        <h1 className="font-display text-3xl tracking-tight">{greeting}{firstName ? `, ${firstName}` : ''}.</h1>
      </header>

      <OnboardingChecklist />

      <section>
        <header className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl flex items-center gap-2">
            <Inbox className="h-4 w-4 text-muted-foreground" /> Inbox
          </h2>
          <Link href="/app/inbox" className="text-xs font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground">
            Open inbox →
          </Link>
        </header>
        <InboxView
          initialFilter={(profile.inbox_filter_default ?? 'mine') as any}
          initialLayout={(profile.inbox_layout ?? 'sections') as any}
          isOwner={profile.role === 'owner'}
          hideUnified
        />
      </section>

      <section className="bg-card rounded-2xl border border-border">
        <header className="flex items-center justify-between px-6 py-5 border-b border-border">
          <h2 className="font-display text-xl flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" /> Today&rsquo;s schedule
          </h2>
          <Link href="/app/schedule" className="text-xs font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground">
            Open schedule →
          </Link>
        </header>
        {(!todayAppts || todayAppts.length === 0) ? (
          <div className="px-6 py-12 text-center">
            <p className="font-display text-lg">No appointments today</p>
            <p className="text-sm text-muted-foreground mt-1">Enjoy the quiet day.</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {todayAppts.map((a: any) => {
              const start = new Date(a.starts_at);
              const isPast = start.getTime() < Date.now() && a.status !== 'in_progress';
              return (
                <li key={a.id}>
                  <Link
                    href={`/app/schedule/${a.id}`}
                    className={`block px-6 py-4 hover:bg-muted/30 transition-colors ${isPast && a.status !== 'completed' ? 'opacity-60' : ''}`}
                  >
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="font-mono text-sm tabular-nums w-16 shrink-0">
                          {start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium truncate">{a.patients?.first_name} {a.patients?.last_name}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            MRN {a.patients?.mrn} · {a.reason ?? String(a.appointment_type).replace(/_/g, ' ')}
                            {profile.role === 'owner' && a.provider && (
                              <span> · {a.provider.full_name}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <span className={`clinical-badge clinical-badge-${
                        a.status === 'completed' ? 'good' :
                        a.status === 'cancelled' || a.status === 'no_show' ? 'high' :
                        a.status === 'arrived' || a.status === 'in_progress' ? 'borderline' :
                        'borderline'
                      } capitalize shrink-0`}>{String(a.status).replace('_', ' ')}</span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
