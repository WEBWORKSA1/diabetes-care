import { createClient } from '@/lib/supabase/server';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Calendar, Clock, User, FileText, Mic, AlertCircle, CheckCircle, XCircle, MessageSquare } from 'lucide-react';
import { logAudit } from '@/lib/audit';
import { formatDateTime } from '@/lib/utils';
import { AppointmentActions } from './appointment-actions';

export const metadata = { title: 'Appointment' };

export default async function AppointmentDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: appt, error } = await supabase
    .from('appointments')
    .select(`
      *,
      patients(id, first_name, last_name, mrn, phone_mobile, sms_consent, diabetes_type, date_of_birth),
      provider:users!appointments_provider_id_fkey(id, full_name, credentials),
      created_by_user:users!appointments_created_by_fkey(full_name)
    `)
    .eq('id', params.id)
    .is('deleted_at', null)
    .single();

  if (error || !appt) return notFound();

  await logAudit({
    organizationId: appt.organization_id,
    userId: user.id,
    action: 'read',
    resourceType: 'appointment',
    resourceId: appt.id,
    patientId: appt.patient_id,
  });

  // Load reminders for this appointment
  const { data: reminders } = await supabase
    .from('appointment_reminders')
    .select('id, kind, status, scheduled_for, sent_at, delivered_at, failed_at, twilio_error_message, patient_action, patient_action_at')
    .eq('appointment_id', appt.id)
    .order('scheduled_for');

  const patient = appt.patients as any;
  const provider = appt.provider as any;

  return (
    <div className="space-y-6 max-w-4xl">
      <Link href="/app/schedule" className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3 w-3" /> Back to schedule
      </Link>

      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Appointment</div>
          <h1 className="font-display text-3xl tracking-tight">
            {patient.last_name}, {patient.first_name}
          </h1>
          <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
            <span className="font-mono">MRN {patient.mrn}</span>
            <span>·</span>
            <span className="capitalize">{appt.appointment_type.replace(/_/g, ' ')}</span>
            <span>·</span>
            <span>{provider.full_name}</span>
          </div>
        </div>
        <StatusBadge status={appt.status} />
      </header>

      <div className="grid sm:grid-cols-2 gap-4">
        <InfoTile icon={<Calendar className="h-4 w-4" />} label="Date & time">
          <div className="font-display text-lg">
            {new Date(appt.starts_at).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </div>
          <div className="text-sm text-muted-foreground tabular-nums">
            {new Date(appt.starts_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
            {' – '}
            {new Date(appt.ends_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
          </div>
        </InfoTile>
        <InfoTile icon={<User className="h-4 w-4" />} label="Patient contact">
          <div className="text-sm font-mono">{patient.phone_mobile ?? 'No phone on file'}</div>
          {patient.sms_consent ? (
            <div className="text-[10px] font-mono uppercase tracking-wider text-green-700 dark:text-green-300 mt-1">✓ SMS consent</div>
          ) : (
            <div className="text-[10px] font-mono uppercase tracking-wider text-amber-700 dark:text-amber-300 mt-1">No SMS consent</div>
          )}
        </InfoTile>
      </div>

      {appt.reason && (
        <section className="bg-card rounded-2xl border border-border p-5">
          <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-1">Reason</div>
          <p className="text-sm">{appt.reason}</p>
        </section>
      )}

      {appt.notes && (
        <section className="bg-card rounded-2xl border border-border p-5">
          <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-1">Notes</div>
          <p className="text-sm whitespace-pre-wrap">{appt.notes}</p>
        </section>
      )}

      <AppointmentActions appointment={appt} currentUserId={user.id} />

      <section className="bg-card rounded-2xl border border-border">
        <header className="px-6 py-4 border-b border-border flex items-center gap-2">
          <Link href={`/app/patients/${patient.id}`} className="inline-flex items-center gap-2 h-9 px-4 rounded-full border border-input bg-card text-sm font-medium hover:bg-muted transition-colors">
            <User className="h-4 w-4" /> Patient chart
          </Link>
          <Link href={`/app/scribe/new?patient=${patient.id}&encounter=${appt.encounter_id ?? ''}`} className="inline-flex items-center gap-2 h-9 px-4 rounded-full border border-accent/30 bg-accent/5 text-accent text-sm font-medium hover:bg-accent/10 transition-colors">
            <Mic className="h-4 w-4" /> AI Scribe
          </Link>
          {appt.encounter_id ? (
            <Link href={`/app/encounters/${appt.encounter_id}`} className="inline-flex items-center gap-2 h-9 px-4 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-accent transition-colors">
              <FileText className="h-4 w-4" /> Open encounter
            </Link>
          ) : (
            <Link href={`/app/encounters/new?patient=${patient.id}`} className="inline-flex items-center gap-2 h-9 px-4 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-accent transition-colors">
              <FileText className="h-4 w-4" /> Start encounter
            </Link>
          )}
        </header>
      </section>

      {reminders && reminders.length > 0 && (
        <section className="bg-card rounded-2xl border border-border">
          <header className="px-6 py-4 border-b border-border flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-display text-lg">SMS reminders</h2>
          </header>
          <ul className="divide-y divide-border">
            {reminders.map((r) => (
              <li key={r.id} className="px-6 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium capitalize">{r.kind.replace(/_/g, ' ')}</div>
                  <div className="text-xs text-muted-foreground">
                    Scheduled: {formatDateTime(r.scheduled_for)}
                    {r.sent_at && ` · Sent: ${formatDateTime(r.sent_at)}`}
                    {r.twilio_error_message && ` · Error: ${r.twilio_error_message}`}
                    {r.patient_action && ` · Patient: ${r.patient_action}`}
                  </div>
                </div>
                <ReminderStatusBadge status={r.status} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function InfoTile({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="bg-card rounded-2xl border border-border p-5">
      <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">
        {icon} {label}
      </div>
      {children}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === 'completed' ? 'good' :
    status === 'cancelled' || status === 'no_show' ? 'high' :
    status === 'confirmed' || status === 'arrived' || status === 'in_progress' ? 'borderline' :
    'borderline';
  return (
    <span className={`clinical-badge clinical-badge-${tone} capitalize`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

function ReminderStatusBadge({ status }: { status: string }) {
  const config: Record<string, { tone: string; icon: any }> = {
    pending: { tone: 'borderline', icon: Clock },
    queued: { tone: 'borderline', icon: Clock },
    sent: { tone: 'good', icon: CheckCircle },
    delivered: { tone: 'good', icon: CheckCircle },
    failed: { tone: 'high', icon: XCircle },
    opted_out: { tone: 'high', icon: AlertCircle },
    cancelled: { tone: 'high', icon: XCircle },
  };
  const c = config[status] ?? config.pending;
  const Icon = c.icon;
  return (
    <span className={`shrink-0 clinical-badge clinical-badge-${c.tone} inline-flex items-center gap-1 capitalize"`}>
      <Icon className="h-3 w-3" /> {status.replace(/_/g, ' ')}
    </span>
  );
}
