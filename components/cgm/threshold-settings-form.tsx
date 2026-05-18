'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Save, RotateCcw } from 'lucide-react';

type ThresholdRow = {
  target_low: number;
  target_high: number;
  urgent_low: number;
  urgent_high: number;
  alert_nocturnal_hypo: boolean;
  alert_postprandial_spike: boolean;
  alert_dawn_phenomenon: boolean;
  alert_high_variability: boolean;
  cv_threshold: number;
} | null;

export function ThresholdSettingsForm({
  patientId,
  initial,
}: {
  patientId: string;
  initial: ThresholdRow;
}) {
  const router = useRouter();
  const defaults = {
    target_low: 70,
    target_high: 180,
    urgent_low: 54,
    urgent_high: 250,
    alert_nocturnal_hypo: true,
    alert_postprandial_spike: true,
    alert_dawn_phenomenon: true,
    alert_high_variability: true,
    cv_threshold: 36,
  };

  const [form, setForm] = useState(
    initial
      ? {
          target_low: Number(initial.target_low),
          target_high: Number(initial.target_high),
          urgent_low: Number(initial.urgent_low),
          urgent_high: Number(initial.urgent_high),
          alert_nocturnal_hypo: initial.alert_nocturnal_hypo,
          alert_postprandial_spike: initial.alert_postprandial_spike,
          alert_dawn_phenomenon: initial.alert_dawn_phenomenon,
          alert_high_variability: initial.alert_high_variability,
          cv_threshold: Number(initial.cv_threshold),
        }
      : defaults
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  async function save() {
    setError(null);
    if (form.urgent_low >= form.target_low || form.target_low >= form.target_high || form.target_high >= form.urgent_high) {
      setError('Thresholds must be ordered: urgent low < target low < target high < urgent high');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/cgm/thresholds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patient_id: patientId, ...form }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Save failed');
        return;
      }
      setSavedAt(new Date());
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function resetToDefaults() {
    setForm(defaults);
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <section className="bg-card rounded-2xl border border-border p-6 space-y-4">
        <h2 className="font-display text-lg">Glucose targets</h2>
        <p className="text-xs text-muted-foreground">Used for TIR calculation and threshold alerts. Defaults follow ADA Standards.</p>
        <div className="grid grid-cols-2 gap-4">
          <NumberField label="Urgent low" value={form.urgent_low} unit="mg/dL" onChange={(v) => setForm({ ...form, urgent_low: v })} min={40} max={80} />
          <NumberField label="Target low" value={form.target_low} unit="mg/dL" onChange={(v) => setForm({ ...form, target_low: v })} min={40} max={120} />
          <NumberField label="Target high" value={form.target_high} unit="mg/dL" onChange={(v) => setForm({ ...form, target_high: v })} min={120} max={300} />
          <NumberField label="Urgent high" value={form.urgent_high} unit="mg/dL" onChange={(v) => setForm({ ...form, urgent_high: v })} min={200} max={400} />
        </div>
      </section>

      <section className="bg-card rounded-2xl border border-border p-6 space-y-4">
        <h2 className="font-display text-lg">Pattern alerts</h2>
        <div className="space-y-3">
          <CheckboxField label="Nocturnal hypoglycemia" description="Glucose drops below target between 22:00 and 06:00" checked={form.alert_nocturnal_hypo} onChange={(v) => setForm({ ...form, alert_nocturnal_hypo: v })} />
          <CheckboxField label="Postprandial spikes" description="Recurring glucose spikes after typical meal times" checked={form.alert_postprandial_spike} onChange={(v) => setForm({ ...form, alert_postprandial_spike: v })} />
          <CheckboxField label="Dawn phenomenon" description="Early-morning glucose rise (04:00–08:00)" checked={form.alert_dawn_phenomenon} onChange={(v) => setForm({ ...form, alert_dawn_phenomenon: v })} />
          <CheckboxField label="High variability" description="CV exceeds threshold (default 36%)" checked={form.alert_high_variability} onChange={(v) => setForm({ ...form, alert_high_variability: v })} />
        </div>

        {form.alert_high_variability && (
          <div className="pt-3 border-t border-dashed border-border">
            <NumberField label="CV threshold" value={form.cv_threshold} unit="%" onChange={(v) => setForm({ ...form, cv_threshold: v })} min={15} max={80} step={1} />
          </div>
        )}
      </section>

      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm p-3">{error}</div>
      )}
      {savedAt && !error && (
        <div className="rounded-lg bg-green-50 dark:bg-green-950 border border-green-300 dark:border-green-800 text-green-900 dark:text-green-100 text-sm p-3">
          ✓ Saved at {savedAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
        </div>
      )}

      <div className="flex items-center justify-end gap-3">
        <button onClick={resetToDefaults} className="inline-flex items-center gap-2 h-10 px-4 rounded-full border border-input bg-card text-sm font-medium hover:bg-muted transition-colors">
          <RotateCcw className="h-4 w-4" /> Reset to ADA defaults
        </button>
        <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 h-10 px-5 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-accent transition-colors disabled:opacity-50">
          <Save className="h-4 w-4" />
          {saving ? 'Saving…' : 'Save thresholds'}
        </button>
      </div>
    </div>
  );
}

function NumberField({ label, value, unit, onChange, min, max, step = 1 }: { label: string; value: number; unit: string; onChange: (v: number) => void; min: number; max: number; step?: number }) {
  return (
    <label className="block space-y-1.5">
      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="relative">
        <input
          type="number"
          inputMode="numeric"
          step={step}
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full h-10 px-3 pr-14 rounded-lg border border-input bg-background text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono uppercase text-muted-foreground pointer-events-none">{unit}</span>
      </div>
    </label>
  );
}

function CheckboxField({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1 rounded" />
      <div>
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
    </label>
  );
}
