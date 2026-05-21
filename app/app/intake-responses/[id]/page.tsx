import { createClient } from '@/lib/supabase/server';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, FileText, Check, Loader2 } from 'lucide-react';
import { formatDateTime } from '@/lib/utils';
import { ReviewActions } from './review-actions';

export const metadata = { title: 'Intake response' };

export default async function IntakeResponsePage({ params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: response, error } = await supabase
    .from('intake_form_responses')
    .select('*, intake_forms(name, description, fields), patients(id, first_name, last_name, mrn), reviewer:users!intake_form_responses_reviewed_by_fkey(full_name), appointments(id, starts_at)')
    .eq('id', params.id)
    .single();

  if (error || !response) return notFound();

  const form = response.intake_forms as any;
  const fields = form?.fields ?? [];
  const responses = (response.responses ?? {}) as Record<string, any>;
  const patient = response.patients as any;
  const appt = response.appointments as any;

  return (
    <div className="max-w-3xl space-y-6">
      <Link href="/app/inbox" className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3 w-3" /> Inbox
      </Link>

      <header className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider text-muted-foreground">
            <FileText className="h-3 w-3" /> Intake form response
          </span>
          <span className={`clinical-badge clinical-badge-${response.status === 'reviewed' ? 'good' : 'borderline'} capitalize`}>
            {String(response.status).replace('_', ' ')}
          </span>
        </div>
        <h1 className="font-display text-3xl tracking-tight">{form?.name}</h1>
        <Link href={`/app/patients/${patient.id}`} className="inline-flex items-center gap-2 text-sm hover:underline">
          <span className="font-medium">{patient.last_name}, {patient.first_name}</span>
          <span className="text-xs font-mono text-muted-foreground">MRN {patient.mrn}</span>
        </Link>
        <div className="text-xs text-muted-foreground">
          Submitted {formatDateTime(response.submitted_at)}
          {appt && (<span> · <Link href={`/app/schedule/${appt.id}`} className="underline">for {new Date(appt.starts_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} visit</Link></span>)}
        </div>
      </header>

      <section className="bg-card rounded-2xl border border-border divide-y divide-border">
        {fields.map((field: any, idx: number) => {
          const value = responses[field.id];
          const display = renderValue(value, field);
          const isFlagged = isClinicallyConcerning(field, value);
          return (
            <div key={field.id} className={`px-6 py-4 ${isFlagged ? 'bg-amber-50/30 dark:bg-amber-950/10' : ''}`}>
              <div className="flex items-start gap-3">
                <span className="text-xs font-mono tabular-nums text-muted-foreground shrink-0 w-6 mt-0.5">{idx + 1}.</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-muted-foreground">{field.label}</div>
                  <div className={`mt-1 ${isFlagged ? 'font-medium text-amber-900 dark:text-amber-100' : 'font-medium'}`}>
                    {display ?? <span className="text-muted-foreground italic">No response</span>}
                  </div>
                </div>
                {isFlagged && (
                  <span className="clinical-badge clinical-badge-borderline text-[10px] shrink-0">Review</span>
                )}
              </div>
            </div>
          );
        })}
      </section>

      {response.status !== 'reviewed' && <ReviewActions responseId={response.id} />}

      {response.reviewed_at && (
        <section className="bg-muted/30 rounded-2xl p-4 text-xs space-y-1">
          <p><strong>Reviewed</strong> by {(response.reviewer as any)?.full_name ?? 'unknown'} at {formatDateTime(response.reviewed_at)}</p>
          {response.review_notes && <p>Notes: {response.review_notes}</p>}
        </section>
      )}
    </div>
  );
}

function renderValue(value: any, field: any): React.ReactNode {
  if (value === undefined || value === null || value === '') return null;
  if (Array.isArray(value)) return value.join(', ');
  if (field.type === 'scale') {
    const min = field.scale_min_label ?? field.scale_min ?? 0;
    const max = field.scale_max_label ?? field.scale_max ?? 10;
    return <span>{value} <span className="text-xs text-muted-foreground font-mono">({min} — {max})</span></span>;
  }
  return String(value);
}

/**
 * Heuristic flag for sections clinicians should pay extra attention to.
 */
function isClinicallyConcerning(field: any, value: any): boolean {
  if (value === undefined || value === null || value === '') return false;
  // PHQ-2 scoring: any answer ≥ 2 flags
  if ((field.id === 'mood' || field.id === 'interest') && typeof value === 'number' && value >= 2) return true;
  // Severe hypo or frequent hypo
  if (field.id === 'hypo_severe' && value === 'Yes') return true;
  if (field.id === 'hypo_episodes' && (value === '3–5' || value === '6+ — happens often')) return true;
  // Foot wounds not healing
  if (field.id === 'foot_check' && value === 'Yes — new or not healing') return true;
  // GLP-1 severe side effects
  if (field.id === 'glp1_side_effects' && (value === 'Severe — had to stop' || value === 'Moderate')) return true;
  // Medication non-adherence
  if (field.id === 'medication_adherence' && (value === 'Missed several doses' || value === 'Stopped taking it')) return true;
  return false;
}
