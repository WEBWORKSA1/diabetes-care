import { createClient } from '@/lib/supabase/server';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, AlertTriangle, MessageSquare, User } from 'lucide-react';
import { formatDateTime } from '@/lib/utils';
import { MessageActions } from './message-actions';

export const metadata = { title: 'Message' };

export default async function MessageDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: message, error } = await supabase
    .from('patient_messages')
    .select('*, patients(id, first_name, last_name, mrn, phone_mobile, sms_consent), ack_by:users!patient_messages_acknowledged_by_fkey(full_name), res_by:users!patient_messages_resolved_by_fkey(full_name)')
    .eq('id', params.id)
    .single();

  if (error || !message) return notFound();

  const patient = message.patients as any;

  return (
    <div className="max-w-3xl space-y-6">
      <Link href="/app/messages" className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3 w-3" /> All messages
      </Link>

      <header className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          {message.priority === 'urgent' && (
            <span className="clinical-badge clinical-badge-high inline-flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> Urgent
            </span>
          )}
          <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
            {formatDateTime(message.sent_at)}
          </span>
        </div>
        <h1 className="font-display text-3xl tracking-tight">{message.subject}</h1>
        <Link href={`/app/patients/${patient.id}`} className="inline-flex items-center gap-2 text-sm hover:underline">
          <User className="h-3.5 w-3.5" />
          <span className="font-medium">{patient.last_name}, {patient.first_name}</span>
          <span className="text-xs font-mono text-muted-foreground">MRN {patient.mrn}</span>
        </Link>
      </header>

      <section className="bg-card rounded-2xl border border-border p-6">
        <h2 className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-3">Message</h2>
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.body}</p>
      </section>

      <section className="bg-card rounded-2xl border border-border p-6 space-y-3">
        <h2 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Patient contact</h2>
        {patient.phone_mobile ? (
          <p className="text-sm font-mono">{patient.phone_mobile}</p>
        ) : (
          <p className="text-sm text-muted-foreground">No phone on file</p>
        )}
        <p className="text-xs text-muted-foreground">
          <strong>Note:</strong> The portal doesn&rsquo;t support replies. Call the patient directly or send an SMS via your existing workflow.
        </p>
      </section>

      <MessageActions message={message} />

      {(message.acknowledged_at || message.resolved_at) && (
        <section className="bg-muted/30 rounded-2xl p-4 text-xs space-y-1">
          {message.acknowledged_at && (
            <p><strong>Acknowledged</strong> by {(message.ack_by as any)?.full_name ?? 'unknown'} at {formatDateTime(message.acknowledged_at)}</p>
          )}
          {message.resolved_at && (
            <p><strong>Resolved</strong> by {(message.res_by as any)?.full_name ?? 'unknown'} at {formatDateTime(message.resolved_at)}{message.resolution_note ? ` · "${message.resolution_note}"` : ''}</p>
          )}
        </section>
      )}
    </div>
  );
}
