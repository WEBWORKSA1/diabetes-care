'use client';

import { useState } from 'react';
import { Pill, Plus, X } from 'lucide-react';

export function MedicationEditor({
  patientId,
  medications,
  onAdded,
  onDiscontinued,
  editable,
}: {
  patientId: string;
  medications: any[];
  onAdded: (m: any) => void;
  onDiscontinued: (id: string) => void;
  editable: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({
    name: '',
    brand_name: '',
    dose: '',
    route: 'oral',
    frequency: 'daily',
    is_diabetes_med: true,
    indication: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const active = medications.filter((m) => !m.discontinued_at);
  const inactive = medications.filter((m) => m.discontinued_at);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/medications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patient_id: patientId, ...form }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'Could not add medication');
        setSubmitting(false);
        return;
      }
      const { id } = await res.json();
      onAdded({ id, ...form, prescribed_at: new Date().toISOString(), discontinued_at: null });
      setForm({ name: '', brand_name: '', dose: '', route: 'oral', frequency: 'daily', is_diabetes_med: true, indication: '' });
      setAdding(false);
    } catch {
      setError('Network error');
    } finally {
      setSubmitting(false);
    }
  }

  async function discontinue(id: string, name: string) {
    const reason = window.prompt(`Discontinue ${name}? Optional reason:`);
    if (reason === null) return;
    try {
      const res = await fetch(`/api/medications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      if (res.ok) onDiscontinued(id);
    } catch {}
  }

  return (
    <section className="bg-card rounded-2xl border border-border">
      <header className="px-5 py-4 border-b border-border flex items-center justify-between">
        <h3 className="font-display text-lg flex items-center gap-2">
          <Pill className="h-4 w-4 text-muted-foreground" /> Medications
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
          <input type="text" required autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Generic name (e.g., Semaglutide)" className="w-full h-9 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          <input type="text" value={form.brand_name} onChange={(e) => setForm({ ...form, brand_name: e.target.value })} placeholder="Brand (optional, e.g., Ozempic)" className="w-full h-9 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          <div className="grid grid-cols-2 gap-2">
            <input type="text" value={form.dose} onChange={(e) => setForm({ ...form, dose: e.target.value })} placeholder="Dose (e.g., 1 mg)" className="h-9 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            <select value={form.route} onChange={(e) => setForm({ ...form, route: e.target.value })} className="h-9 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring">
              <option value="oral">Oral</option>
              <option value="subcutaneous">Subcutaneous</option>
              <option value="intramuscular">IM</option>
              <option value="intravenous">IV</option>
              <option value="topical">Topical</option>
              <option value="inhaled">Inhaled</option>
            </select>
          </div>
          <input type="text" value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })} placeholder="Frequency (e.g., weekly)" className="w-full h-9 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          <input type="text" value={form.indication} onChange={(e) => setForm({ ...form, indication: e.target.value })} placeholder="Indication (e.g., T2DM)" className="w-full h-9 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_diabetes_med} onChange={(e) => setForm({ ...form, is_diabetes_med: e.target.checked })} className="rounded" />
            Diabetes medication
          </label>
          {error && <div className="text-xs text-destructive">{error}</div>}
          <div className="flex gap-2">
            <button type="submit" disabled={submitting || !form.name} className="flex-1 h-9 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-accent transition-colors disabled:opacity-50">
              {submitting ? 'Adding…' : 'Add medication'}
            </button>
            <button type="button" onClick={() => { setAdding(false); setError(null); }} className="h-9 px-4 rounded-lg border border-input bg-card text-sm hover:bg-muted transition-colors">
              Cancel
            </button>
          </div>
        </form>
      )}

      {active.length === 0 ? (
        <div className="px-5 py-8 text-center text-sm text-muted-foreground">No active medications.</div>
      ) : (
        <ul className="divide-y divide-border max-h-96 overflow-y-auto">
          {active.map((m) => (
            <li key={m.id} className="px-5 py-3 flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="font-medium text-sm">
                  {m.brand_name ? `${m.brand_name} (${m.name})` : m.name}
                  {m.is_diabetes_med && <span className="ml-2 clinical-badge clinical-badge-good">DM</span>}
                </div>
                <div className="text-[11px] text-muted-foreground font-mono mt-0.5">
                  {[m.dose, m.route, m.frequency].filter(Boolean).join(' · ') || '—'}
                </div>
                {m.indication && (<div className="text-[11px] text-muted-foreground mt-0.5">For: {m.indication}</div>)}
              </div>
              {editable && (
                <button onClick={() => discontinue(m.id, m.brand_name || m.name)} className="shrink-0 text-muted-foreground hover:text-destructive p-1" aria-label="Discontinue" title="Discontinue">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {inactive.length > 0 && (
        <details className="border-t border-border">
          <summary className="px-5 py-3 text-xs font-mono uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-foreground">
            Discontinued ({inactive.length})
          </summary>
          <ul className="divide-y divide-border bg-muted/30">
            {inactive.slice(0, 10).map((m) => (
              <li key={m.id} className="px-5 py-2 text-xs text-muted-foreground line-through">
                {m.brand_name || m.name} · {m.dose}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
