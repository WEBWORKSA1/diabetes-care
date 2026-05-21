import { getCurrentPortalSession } from '@/lib/portal/auth';
import { createServiceClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { Calendar, MapPin } from 'lucide-react';
import Link from 'next/link';

export const metadata = { title: 'My visits' };

export default async function PortalAppointmentsPage() {
  const session = await getCurrentPortalSession();
  if (!session) redirect('/portal/signin');

  const admin = createServiceClient();
  const { data: appts } = await admin
    .from('appointments')
    .select('id, starts_at, ends_at, status, appointment_type, reason, location, timezone, provider:users!appointments_provider_id_fkey(full_name, credentials)')
    .eq('patient_id', session.patient_id)
    .is('deleted_at', null)
    .order('starts_at', { ascending: false })
    .limit(50);

  const upcoming = (appts ?? []).filter((a: any) => new Date(a.starts_at) >= new Date() && !['cancelled', 'no_show'].includes(a.status));
  const past = (appts ?? []).filter((a: any) => new Date(a.starts_at) < new Date() || ['cancelled', 'no_show'].includes(a.status));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl sm:text-3xl tracking-tight">My visits</h1>
        <p className="text-sm text-muted-foreground mt-1">Upcoming and past appointments.</p>
      </header>

      {upcoming.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Upcoming</h2>
          <ul className="space-y-2">
            {upcoming.map((a: any) => <AppointmentCard key={a.id} appt={a} upcoming />)}
          </ul>
        </section>
      )}

      {past.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Past</h2>
          <ul className="space-y-2">
            {past.map((a: any) => <AppointmentCard key={a.id} appt={a} upcoming={false} />)}
          </ul>
        </section>
      )}

      {(!appts || appts.length === 0) && (
        <div className="py-12 text-center bg-card rounded-2xl border border-border">
          <p className="font-display text-lg">No visits yet</p>
          <p className="text-sm text-muted-foreground mt-1">Your appointments will appear here.</p>
        </div>
      )}
    </div>
  );
}

function AppointmentCard({ appt, upcoming }: { appt: any; upcoming: boolean }) {
  const date = new Date(appt.starts_at);
  return (
    <li className="bg-card border border-border rounded-2xl p-4">
      <div className="flex items-start gap-3">
        <div className="shrink-0 text-center w-12">
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{date.toLocaleDateString('en-US', { month: 'short' })}</div>
          <div className="font-display text-2xl tabular-nums">{date.getDate()}</div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium">
            {date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: appt.timezone })}
          </div>
          <div className="text-sm text-muted-foreground capitalize">
            {String(appt.appointment_type).replace(/_/g, ' ')}
            {appt.provider && (<span> · Dr. {appt.provider.full_name}</span>)}
          </div>
          {appt.reason && <div className="text-xs text-muted-foreground mt-1">{appt.reason}</div>}
        </div>
        <span className={`shrink-0 clinical-badge clinical-badge-${
          appt.status === 'completed' ? 'good' :
          appt.status === 'cancelled' || appt.status === 'no_show' ? 'high' :
          'borderline'
        } capitalize`}>{String(appt.status).replace('_', ' ')}</span>
      </div>
    </li>
  );
}
