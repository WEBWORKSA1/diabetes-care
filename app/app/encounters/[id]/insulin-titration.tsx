'use client';

import { useState, useMemo } from 'react';
import { X, Calculator, Check, AlertTriangle } from 'lucide-react';
import { calculateTitration, type InsulinType } from '@/lib/clinical/insulin-titration';

export function InsulinTitrationDrawer({
  onClose,
  medications,
  onAppendToPlan,
}: {
  onClose: () => void;
  medications: any[];
  onAppendToPlan: (text: string) => void;
}) {
  const insulinMeds = medications.filter((m) =>
    !m.discontinued_at && /insulin|glargine|degludec|detemir|lispro|aspart|glulisine|humalog|novolog|lantus|toujeo|tresiba|levemir|basaglar/i.test(`${m.name} ${m.brand_name ?? ''}`)
  );

  const [insulinType, setInsulinType] = useState<InsulinType>('basal');
  const [currentDose, setCurrentDose] = useState<string>('');
  const [fbg, setFbg] = useState<string>('');
  const [pmg, setPmg] = useState<string>('');
  const [hypos, setHypos] = useState<string>('0');
  const [weightKg, setWeightKg] = useState<string>('');

  const result = useMemo(() => {
    const dose = Number(currentDose);
    if (Number.isNaN(dose) || dose <= 0) return null;
    return calculateTitration({
      insulinType,
      currentDose: dose,
      fastingGlucose: insulinType === 'basal' && fbg ? Number(fbg) : undefined,
      preMealGlucose: insulinType === 'prandial' && pmg ? Number(pmg) : undefined,
      hypoEpisodes: hypos ? Number(hypos) : 0,
      patientWeightKg: weightKg ? Number(weightKg) : undefined,
    });
  }, [insulinType, currentDose, fbg, pmg, hypos, weightKg]);

  function appendAndClose() {
    if (!result) return;
    const directionLabel = result.change > 0 ? `INCREASE by ${result.change}u` : result.change < 0 ? `DECREASE by ${Math.abs(result.change)}u` : 'NO CHANGE';
    const text = [
      `Insulin titration (${insulinType}):`,
      `Current ${currentDose}u → Recommended ${result.recommendedDose}u (${directionLabel})`,
      `Rationale: ${result.rationale}`,
      result.warnings.length > 0 ? `Warnings: ${result.warnings.join(' ')}` : null,
    ].filter(Boolean).join('\n');
    onAppendToPlan(text);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-foreground/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl border border-border w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <header className="sticky top-0 bg-card px-6 py-4 border-b border-border flex items-center justify-between z-10">
          <h2 className="font-display text-xl flex items-center gap-2">
            <Calculator className="h-5 w-5" /> Insulin titration
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="px-6 py-5 space-y-4">
          <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
            Provider verifies all recommendations before applying. Not medical advice.
          </div>
          <label className="block space-y-1.5">
            <div className="text-xs font-medium uppercase tracking-wider">Insulin type</div>
            <select value={insulinType} onChange={(e) => setInsulinType(e.target.value as InsulinType)} className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring">
              <option value="basal">Basal (glargine, degludec, detemir)</option>
              <option value="prandial">Prandial (rapid-acting: lispro, aspart, glulisine)</option>
              <option value="mixed">Mixed / premixed</option>
            </select>
          </label>
          {insulinMeds.length > 0 && (
            <div className="text-xs text-muted-foreground">
              Patient insulins on file: {insulinMeds.map((m) => m.brand_name || m.name).join(', ')}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1.5">
              <div className="text-xs font-medium uppercase tracking-wider">Current dose (u)</div>
              <input type="number" min="0" step="1" inputMode="numeric" value={currentDose} onChange={(e) => setCurrentDose(e.target.value)} placeholder="20" className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-ring" />
            </label>
            <label className="block space-y-1.5">
              <div className="text-xs font-medium uppercase tracking-wider">Hypos / 7 days</div>
              <input type="number" min="0" step="1" inputMode="numeric" value={hypos} onChange={(e) => setHypos(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-ring" />
            </label>
          </div>
          {insulinType === 'basal' && (
            <label className="block space-y-1.5">
              <div className="text-xs font-medium uppercase tracking-wider">Avg fasting glucose (mg/dL)</div>
              <input type="number" min="20" max="600" step="1" inputMode="numeric" value={fbg} onChange={(e) => setFbg(e.target.value)} placeholder="3-day average" className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-ring" />
            </label>
          )}
          {insulinType === 'prandial' && (
            <label className="block space-y-1.5">
              <div className="text-xs font-medium uppercase tracking-wider">Avg 2hr post-meal glucose (mg/dL)</div>
              <input type="number" min="20" max="600" step="1" inputMode="numeric" value={pmg} onChange={(e) => setPmg(e.target.value)} placeholder="3-day average for the meal being titrated" className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-ring" />
            </label>
          )}
          <label className="block space-y-1.5">
            <div className="text-xs font-medium uppercase tracking-wider">Weight (kg, optional)</div>
            <input type="number" min="20" step="0.1" inputMode="decimal" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-ring" />
          </label>
          {result && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Recommendation</div>
                  <div className="font-display text-2xl tabular-nums">
                    {currentDose}u → <span className={result.change > 0 ? 'text-red-700 dark:text-red-300' : result.change < 0 ? 'text-amber-700 dark:text-amber-300' : ''}>{result.recommendedDose}u</span>
                  </div>
                  <div className="text-xs font-mono text-muted-foreground mt-0.5">
                    {result.change > 0 ? `+${result.change}` : result.change} units · {result.rule}
                  </div>
                </div>
              </div>
              <p className="text-sm">{result.rationale}</p>
              {result.warnings.length > 0 && (
                <div className="space-y-1.5">
                  {result.warnings.map((w, i) => (
                    <div key={i} className="flex gap-2 text-xs">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                      <span>{w}</span>
                    </div>
                  ))}
                </div>
              )}
              <button onClick={appendAndClose} className="w-full h-10 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-accent transition-colors inline-flex items-center justify-center gap-2">
                <Check className="h-4 w-4" /> Append to Plan
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
