'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, FileText, Sparkles } from 'lucide-react';
import { diabetesTypeLabel } from '@/lib/utils';

const ENCOUNTER_TYPES = [
  { value: 'follow_up', label: 'Follow-up' },
  { value: 'new_patient', label: 'New patient' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'telehealth', label: 'Telehealth' },
  { value: 'cgm_review', label: 'CGM review' },
  { value: 'medication_adjustment', label: 'Medication adjustment' },
  { value: 'lab_review', label: 'Lab review' },
];

export function TemplatePicker({ patient, templates }: { patient: any; templates: any[] }) {
  const router = useRouter();
  const [encounterType, setEncounterType] = useState('follow_up');
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [templateSlug, setTemplateSlug] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/encounters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: patient.id,
          encounter_type: encounterType,
          template_slug: templateSlug,
          chief_complaint: chiefComplaint || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'Could not start encounter');
        setSubmitting(false);
        return;
      }
      const { id } = await res.json();
      router.push(`/app/encounters/${id}`);
    } catch {
      setError('Network error');
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-8">
      <Link href={`/app/patients/${patient.id}`} className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3 w-3" /> Back to patient
      </Link>
      <header className="space-y-2">
        <h1 className="font-display text-3xl tracking-tight">New encounter</h1>
        <p className="text-sm text-muted-foreground">
          For <strong className="text-foreground">{patient.last_name}, {patient.first_name}</strong>{' '}
          (MRN {patient.mrn} · {diabetesTypeLabel(patient.diabetes_type)})
        </p>
      </header>

      <section className="bg-card rounded-2xl border border-border p-6 space-y-4">
        <h2 className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Visit type</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {ENCOUNTER_TYPES.map((t) => (
            <button key={t.value} type="button" onClick={() => setEncounterType(t.value)} className={`h-10 px-4 rounded-lg border text-sm transition-colors ${encounterType === t.value ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-input hover:bg-muted'}`}>
              {t.label}
            </button>
          ))}
        </div>
      </section>

      <section className="bg-card rounded-2xl border border-border p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Starting template</h2>
          <span className="text-xs text-muted-foreground">
            {templates.length} template{templates.length === 1 ? '' : 's'} for {diabetesTypeLabel(patient.diabetes_type)}
          </span>
        </div>
        <div className="grid gap-2">
          <button type="button" onClick={() => setTemplateSlug(null)} className={`text-left p-4 rounded-lg border transition-colors ${templateSlug === null ? 'bg-primary/5 border-primary' : 'bg-card border-input hover:bg-muted'}`}>
            <div className="font-medium flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              Blank encounter
            </div>
            <div className="text-xs text-muted-foreground mt-1">Start from scratch with empty SOAP fields.</div>
          </button>
          {templates.map((t) => (
            <button key={t.slug} type="button" onClick={() => setTemplateSlug(t.slug)} className={`text-left p-4 rounded-lg border transition-colors ${templateSlug === t.slug ? 'bg-primary/5 border-primary' : 'bg-card border-input hover:bg-muted'}`}>
              <div className="font-medium flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-accent" />
                {t.name}
                {t.is_system && (
                  <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted text-muted-foreground">System</span>
                )}
              </div>
              <div className="text-xs text-muted-foreground mt-1">{t.description}</div>
            </button>
          ))}
        </div>
      </section>

      <section className="bg-card rounded-2xl border border-border p-6 space-y-3">
        <h2 className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Chief complaint (optional)</h2>
        <input type="text" value={chiefComplaint} onChange={(e) => setChiefComplaint(e.target.value)} placeholder="e.g., Q3 diabetes follow-up; CGM review" className="w-full h-11 px-4 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
      </section>

      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm p-3">{error}</div>
      )}

      <div className="flex items-center justify-end gap-3">
        <Link href={`/app/patients/${patient.id}`} className="h-10 px-5 rounded-full border border-input bg-card text-sm font-medium hover:bg-muted transition-colors leading-10">
          Cancel
        </Link>
        <button onClick={start} disabled={submitting} className="h-10 px-6 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-accent transition-colors disabled:opacity-50">
          {submitting ? 'Starting…' : 'Start encounter →'}
        </button>
      </div>
    </div>
  );
}
