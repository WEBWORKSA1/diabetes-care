'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, Save, Loader2, AlertCircle, FlaskConical } from 'lucide-react';

const LAB_TESTS = [
  { value: 'a1c', label: 'A1C', unit: '%', refLow: 4.0, refHigh: 5.7 },
  { value: 'fasting_glucose', label: 'Fasting glucose', unit: 'mg/dL', refLow: 70, refHigh: 99 },
  { value: 'random_glucose', label: 'Random glucose', unit: 'mg/dL', refLow: 70, refHigh: 140 },
  { value: 'ldl', label: 'LDL cholesterol', unit: 'mg/dL', refLow: 0, refHigh: 100 },
  { value: 'hdl', label: 'HDL cholesterol', unit: 'mg/dL', refLow: 40, refHigh: 999 },
  { value: 'triglycerides', label: 'Triglycerides', unit: 'mg/dL', refLow: 0, refHigh: 150 },
  { value: 'total_cholesterol', label: 'Total cholesterol', unit: 'mg/dL', refLow: 0, refHigh: 200 },
  { value: 'egfr', label: 'eGFR', unit: 'mL/min/1.73m²', refLow: 60, refHigh: 999 },
  { value: 'creatinine', label: 'Creatinine', unit: 'mg/dL', refLow: 0.6, refHigh: 1.3 },
  { value: 'urine_acr', label: 'Urine ACR', unit: 'mg/g', refLow: 0, refHigh: 30 },
  { value: 'tsh', label: 'TSH', unit: 'mIU/L', refLow: 0.4, refHigh: 4.5 },
];

export function LabEntryModal({
  patientId,
  defaultTest,
  onClose,
  onSaved,
}: {
  patientId: string;
  defaultTest?: string;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);
  const [test, setTest] = useState(defaultTest ?? 'a1c');
  const [value, setValue] = useState('');
  const [collectedAt, setCollectedAt] = useState(today);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const testDef = LAB_TESTS.find((t) => t.value === test) ?? LAB_TESTS[0];
  const numericValue = Number(value);
  const validNumeric = !isNaN(numericValue) && value.trim() !== '';
  const outOfRange = validNumeric && (numericValue < testDef.refLow || numericValue > testDef.refHigh);

  async function submit() {
    if (!validNumeric) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/labs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: patientId,
          test_name: test,
          value: numericValue,
          unit: testDef.unit,
          collected_at: collectedAt,
          reference_low: testDef.refLow,
          reference_high: testDef.refHigh,
          source: 'manual',
          notes: notes || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Could not save lab');
        return;
      }
      if (onSaved) onSaved();
      router.refresh();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl border border-border w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <header className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h2 className="font-display text-xl flex items-center gap-2">
            <FlaskConical className="h-4 w-4 text-muted-foreground" /> Add lab result
          </h2>
          <button onClick={onClose} className="h-8 w-8 rounded-full hover:bg-muted flex items-center justify-center">
            <X className="h-4 w-4" />
          </button>
        </header>

        <form
          onSubmit={(e) => { e.preventDefault(); submit(); }}
          className="px-6 py-5 space-y-4"
        >
          <label className="block space-y-1.5">
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Test</div>
            <select value={test} onChange={(e) => setTest(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm">
              {LAB_TESTS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1.5">
              <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Value</div>
              <div className="relative">
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  autoFocus
                  required
                  className="w-full h-10 px-3 pr-16 rounded-lg border border-input bg-background text-sm tabular-nums"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono uppercase text-muted-foreground pointer-events-none">{testDef.unit}</span>
              </div>
              <div className="text-[10px] font-mono text-muted-foreground">
                Ref: {testDef.refLow}{testDef.refHigh < 999 ? `–${testDef.refHigh}` : '+'} {testDef.unit}
              </div>
            </label>
            <label className="block space-y-1.5">
              <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Collected</div>
              <input
                type="date"
                value={collectedAt}
                onChange={(e) => setCollectedAt(e.target.value)}
                max={today}
                className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm tabular-nums"
              />
            </label>
          </div>

          {outOfRange && (
            <div className="rounded-lg bg-amber-50 dark:bg-amber-950 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-100 text-xs p-3 flex items-start gap-2">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>Value is outside the reference range. Confirm before saving.</span>
            </div>
          )}

          <label className="block space-y-1.5">
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Notes (optional)</div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              maxLength={500}
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm resize-y"
              placeholder="e.g. point-of-care"
            />
          </label>

          {error && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm p-3">{error}</div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="h-10 px-5 rounded-full border border-input bg-card text-sm font-medium hover:bg-muted transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={!validNumeric || submitting}
              className="inline-flex items-center gap-2 h-10 px-5 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-accent transition-colors disabled:opacity-50"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save lab
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
