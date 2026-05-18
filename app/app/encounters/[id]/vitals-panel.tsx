'use client';

import { useMemo } from 'react';
import { calculateBMI } from '@/lib/clinical/encounter';

type Vitals = {
  bp_sys?: number | null;
  bp_dia?: number | null;
  hr?: number | null;
  temp?: number | null;
  weight_kg?: number | null;
  height_cm?: number | null;
  bmi?: number | null;
};

export function VitalsPanel({
  vitals,
  onChange,
  editable,
}: {
  vitals: Vitals;
  onChange: (v: Vitals) => void;
  editable: boolean;
}) {
  const bmi = useMemo(() => calculateBMI(vitals.weight_kg, vitals.height_cm), [vitals.weight_kg, vitals.height_cm]);

  function update<K extends keyof Vitals>(key: K, value: string) {
    const num = value === '' ? null : Number(value);
    if (value !== '' && Number.isNaN(num)) return;
    const next: Vitals = { ...vitals, [key]: num };
    if (key === 'weight_kg' || key === 'height_cm') {
      next.bmi = calculateBMI(next.weight_kg, next.height_cm) ?? null;
    }
    onChange(next);
  }

  return (
    <div className="mt-4 pt-4 border-t border-dashed border-border">
      <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground mb-3">Vitals</div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <VitalField label="BP sys" suffix="mmHg" value={vitals.bp_sys} onChange={(v) => update('bp_sys', v)} editable={editable} />
        <VitalField label="BP dia" suffix="mmHg" value={vitals.bp_dia} onChange={(v) => update('bp_dia', v)} editable={editable} />
        <VitalField label="HR" suffix="bpm" value={vitals.hr} onChange={(v) => update('hr', v)} editable={editable} />
        <VitalField label="Temp" suffix="°F" step="0.1" value={vitals.temp} onChange={(v) => update('temp', v)} editable={editable} />
        <VitalField label="Weight" suffix="kg" step="0.1" value={vitals.weight_kg} onChange={(v) => update('weight_kg', v)} editable={editable} />
        <VitalField label="Height" suffix="cm" value={vitals.height_cm} onChange={(v) => update('height_cm', v)} editable={editable} />
      </div>
      {bmi !== null && (
        <div className="mt-3 text-xs text-muted-foreground">
          <span className="font-mono">BMI: <strong className="text-foreground tabular-nums">{bmi}</strong></span>
          {bmi >= 30 && <span className="ml-2 clinical-badge clinical-badge-high">Obesity (class {bmi >= 40 ? 'III' : bmi >= 35 ? 'II' : 'I'})</span>}
          {bmi >= 25 && bmi < 30 && <span className="ml-2 clinical-badge clinical-badge-borderline">Overweight</span>}
          {bmi >= 18.5 && bmi < 25 && <span className="ml-2 clinical-badge clinical-badge-good">Normal</span>}
          {bmi < 18.5 && <span className="ml-2 clinical-badge clinical-badge-borderline">Underweight</span>}
        </div>
      )}
    </div>
  );
}

function VitalField({
  label,
  suffix,
  value,
  onChange,
  editable,
  step,
}: {
  label: string;
  suffix: string;
  value: number | null | undefined;
  onChange: (v: string) => void;
  editable: boolean;
  step?: string;
}) {
  return (
    <label className="block space-y-1">
      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="relative">
        <input
          type="number"
          step={step ?? '1'}
          inputMode="decimal"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          disabled={!editable}
          className="w-full h-9 px-3 pr-12 rounded-lg border border-input bg-background text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono uppercase text-muted-foreground pointer-events-none">
          {suffix}
        </span>
      </div>
    </label>
  );
}
