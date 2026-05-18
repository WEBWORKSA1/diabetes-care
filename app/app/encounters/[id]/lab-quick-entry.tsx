'use client';

import { useState } from 'react';
import { FlaskConical, Plus } from 'lucide-react';
import { DIABETES_LABS } from '@/lib/clinical/encounter';
import { formatDate } from '@/lib/utils';

export function LabQuickEntry({
  patientId,
  encounterId,
  labs,
  onLabAdded,
  editable,
}: {
  patientId: string;
  encounterId: string;
  labs: any[];
  onLabAdded: (lab: any) => void;
  editable: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [testName, setTestName] = useState<string>('a1c');
  const [value, setValue] = useState<string>('');
  const [collectedAt, setCollectedAt] = useState<string>(new Date().toISOString().slice(0, 10));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const known = DIABETES_LABS.find((l) => l.name === testName)!;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const numValue = Number(value);
    if (Number.isNaN(numValue) || numValue <= 0) {
      setError('Enter a numeric value');
      setSubmitting(false);
      return;
    }
    try {
      const res = await fetch('/api/labs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: patientId,
          encounter_id: encounterId,
          test_name: known.name,
          value: numValue,
          unit: known.unit,
          collected_at: collectedAt,
          loinc_code: known.loinc,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'Could not save lab');
        setSubmitting(false);
        return;
      }
      const { id } = await res.json();
      onLabAdded({
        id,
        test_name: known.name,
        value: numValue,
        unit: known.unit,
        reference_low: known.refLow,
        reference_high: known.refHigh,
        is_abnormal: numValue < known.refLow || numValue > known.refHigh,
        collected_at: `${collectedAt}T12:00:00Z`,
      });
      setValue('');
      setAdding(false);
    } catch {
      setError('Network error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="bg-card rounded-2xl border border-border">
      <header className="px-5 py-4 border-b border-border flex items-center justify-between">
        <h3 className="font-display text-lg flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-muted-foreground" /> Labs
        </h3>
        {editable && !adding && (
          <button
            onClick={() => setAdding(true)}
            className="text-xs font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          >
            <Plus className="h-3 w-3" /> Add
          </button>
        )}
      </header>

      {adding && (
        <form onSubmit={submit} className="px-5 py-4 border-b border-border space-y-3 bg-muted/30">
          <label className="block">
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">Test</div>
            <select
              value={testName}
              onChange={(e) => setTestName(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {DIABETES_LABS.map((l) => (
                <option key={l.name} value={l.name}>{l.label} ({l.unit})</option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">Value</div>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  required
                  autoFocus
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  className="w-full h-9 px-3 pr-12 rounded-lg border border-input bg-background text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono uppercase text-muted-foreground pointer-events-none">
                  {known.unit}
                </span>
              </div>
            </label>
            <label className="block">
              <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">Date</div>
              <input
                type="date"
                value={collectedAt}
                onChange={(e) => setCollectedAt(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
          </div>
          {value && (
            <div className="text-xs text-muted-foreground">
              Ref range: <span className="font-mono">{known.refLow}–{known.refHigh} {known.unit}</span>
              {' · '}
              {Number(value) < known.refLow ? <span className="text-amber-700">below range</span> :
               Number(value) > known.refHigh ? <span className="text-red-700">above range</span> :
               <span className="text-green-700">in range</span>}
            </div>
          )}
          {error && <div className="text-xs text-destructive">{error}</div>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 h-9 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-accent transition-colors disabled:opacity-50"
            >
              {submitting ? 'Saving…' : 'Save lab'}
            </button>
            <button
              type="button"
              onClick={() => { setAdding(false); setError(null); }}
              className="h-9 px-4 rounded-lg border border-input bg-card text-sm hover:bg-muted transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {labs.length === 0 ? (
        <div className="px-5 py-8 text-center text-sm text-muted-foreground">No labs recorded.</div>
      ) : (
        <ul className="divide-y divide-border max-h-80 overflow-y-auto">
          {labs.slice(0, 10).map((l) => (
            <li key={l.id} className="px-5 py-3 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="font-medium text-sm uppercase">{l.test_name.replace(/_/g, ' ')}</div>
                <div className="text-[11px] text-muted-foreground font-mono">{formatDate(l.collected_at)}</div>
              </div>
              <div className="text-right shrink-0">
                <div className={`font-display text-lg tabular-nums ${l.is_abnormal ? 'text-red-700 dark:text-red-300' : ''}`}>
                  {l.value}<span className="text-xs text-muted-foreground ml-1">{l.unit}</span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
