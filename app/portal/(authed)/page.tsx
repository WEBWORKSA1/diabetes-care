import { getCurrentPortalSession } from '@/lib/portal/auth';
import { createServiceClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Calendar, FlaskConical, FileText, MessageSquare, ChevronRight, AlertCircle } from 'lucide-react';

export default async function PortalHomePage() {
  const session = await getCurrentPortalSession();
  if (!session) redirect('/portal/signin');

  const admin = createServiceClient();
  const now = new Date();

  const [{ data: patient }, { data: nextAppt }, { data: pendingForms }, { count: resultsCount }] = await Promise.all([
    admin.from('patients').select('first_name, last_name, sms_consent, phone_mobile').eq('id', session.patient_id).single(),
    admin
      .from('appointments')
      .select('id, starts_at, appointment_type, reason, timezone, status, provider:users!appointments_provider_id_fkey(full_name, credentials)')
      .eq('patient_id', session.patient_id)
      .gte('starts_at', now.toISOString())
      .not('status', 'in', '(cancelled,no_show)')
      .is('deleted_at', null)
      .order('starts_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
    admin
      .from('intake_form_responses')
      .select('id, intake_forms(name), sent_at, status')
      .eq('patient_id', session.patient_id)
      .in('status', ['sent', 'started'])
      .order('sent_at', { ascending: false })
      .limit(5),
    admin
      .from('lab_values')
      .select('id', { count: 'exact', head: true })
      .eq('patient_id', session.patient_id)
      .eq('patient_release_held', false)
      .is('deleted_at', null),
  ]);

  if (!patient) redirect('/portal/signin');

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl sm:text-3xl tracking-tight">
          Hi, {patient.first_name}.
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Here&rsquo;s what&rsquo;s waiting for you.</p>
      </header>

      {pendingForms && pendingForms.length > 0 && (
        <section className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-2xl p-5">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-4 w-4 text-amber-700 dark:text-amber-300 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h2 className="font-medium text-amber-900 dark:text-amber-100">
                You have {pendingForms.length} form{pendingForms.length === 1 ? '' : 's'} to fill out
              </h2>
              <p className="text-sm text-amber-800 dark:text-amber-200 mt-1">
                These help your provider prepare for your visit.
              </p>
              <ul className="mt-3 space-y-1.5">
                {pendingForms.map((f: any) => (
                  <li key={f.id}>
                    <Link
                      href={`/portal/intake/${f.id}`}
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-900 dark:text-amber-100 hover:underline"
                    >
                      {f.intake_forms?.name ?? 'Pre-visit form'} <ChevronRight className="h-3 w-3" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}

      {nextAppt && (
        <section className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Calendar className="h-4 w-4" />
            </div>
            <div className="flex-1">
              <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Next visit</div>
              <div className="font-display text-xl mt-0.5">
                {new Date(nextAppt.starts_at).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </div>
              <div className="text-sm text-muted-foreground">
                {new Date(nextAppt.starts_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: nextAppt.timezone })}
                {nextAppt.provider && (<span> · with Dr. {(nextAppt.provider as any).full_name}</span>)}
              </div>
              <Link
                href={`/portal/appointments/${nextAppt.id}`}
                className="inline-flex items-center gap-1.5 mt-3 text-sm font-medium hover:underline"
              >
                View details <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </section>
      )}

      <div className="grid sm:grid-cols-2 gap-3">
        <NavCard href="/portal/results" icon={FlaskConical} title="Lab results" sub={`${resultsCount ?? 0} on file`} />
        <NavCard href="/portal/appointments" icon={Calendar} title="All visits" sub="Past and upcoming" />
        <NavCard href="/portal/forms" icon={FileText} title="Forms" sub="Past and pending" />
        <NavCard href="/portal/message" icon={MessageSquare} title="Send a message" sub="Non-urgent only" />
      </div>
    </div>
  );
}

function NavCard({ href, icon: Icon, title, sub }: { href: string; icon: any; title: string; sub: string }) {
  return (
    <Link
      href={href}
      className="bg-card border border-border rounded-2xl p-4 hover:border-foreground/30 transition-colors group flex items-center gap-3"
    >
      <div className="p-2 rounded-lg bg-muted text-muted-foreground group-hover:bg-accent/10 group-hover:text-accent transition-colors">
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium">{title}</div>
        <div className="text-xs text-muted-foreground">{sub}</div>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </Link>
  );
}
