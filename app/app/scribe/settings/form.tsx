'use client';

import { useEffect, useState } from 'react';
import { Check, Lock } from 'lucide-react';

export function ScribeSettingsForm() {
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [form, setForm] = useState({
    scribe_llm_preference: 'claude' as 'claude' | 'gpt4o',
    audio_retention_days: 30,
    scribe_enabled: true,
  });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/scribe/settings')
      .then((r) => r.json())
      .then((d) => {
        if (d.settings) setForm(d.settings);
        setIsOwner(!!d.is_owner);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setError(null);
    setSuccess(false);
    setSaving(true);
    try {
      const res = await fetch('/api/scribe/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Save failed');
        return;
      }
      setSuccess(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="text-sm text-muted-foreground">Loading…</div>;

  if (!isOwner) {
    return (
      <div className="rounded-lg bg-muted/50 p-6 text-center space-y-3">
        <Lock className="h-8 w-8 mx-auto text-muted-foreground/60" />
        <p className="font-display text-lg">Owner only</p>
        <p className="text-sm text-muted-foreground">
          Only practice owners can change AI Scribe settings. Current settings:
        </p>
        <ul className="text-sm text-left max-w-sm mx-auto space-y-1 pt-2">
          <li><strong>LLM:</strong> {form.scribe_llm_preference === 'claude' ? 'Claude Opus 4.7' : 'GPT-4o'}</li>
          <li><strong>Audio retention:</strong> {form.audio_retention_days} days</li>
          <li><strong>Scribe enabled:</strong> {form.scribe_enabled ? 'Yes' : 'No'}</li>
        </ul>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="bg-card rounded-2xl border border-border p-6 space-y-4">
        <h2 className="font-display text-lg">SOAP generation model</h2>
        <p className="text-xs text-muted-foreground">Which LLM generates the SOAP draft from the transcript. Both models receive identical prompts and run identical guardrails.</p>
        <div className="grid sm:grid-cols-2 gap-3">
          <ModelCard value="claude" current={form.scribe_llm_preference} onSelect={(v) => setForm({ ...form, scribe_llm_preference: v })}
            name="Claude Opus 4.7" description="Recommended. Stronger structured output and instruction following. Higher cost per draft." cost="~$0.18 per 10-min visit" />
          <ModelCard value="gpt4o" current={form.scribe_llm_preference} onSelect={(v) => setForm({ ...form, scribe_llm_preference: v })}
            name="GPT-4o" description="Faster, lower cost. JSON mode guarantees parseable output." cost="~$0.03 per 10-min visit" />
        </div>
      </section>

      <section className="bg-card rounded-2xl border border-border p-6 space-y-4">
        <h2 className="font-display text-lg">Audio retention</h2>
        <p className="text-xs text-muted-foreground">After this many days, recorded audio is automatically deleted from storage. Transcripts and drafts are retained. Default is 30 days.</p>
        <label className="block space-y-1.5">
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Retention period</div>
          <div className="relative max-w-xs">
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={90}
              value={form.audio_retention_days}
              onChange={(e) => setForm({ ...form, audio_retention_days: Math.max(1, Math.min(90, Number(e.target.value))) })}
              className="w-full h-10 px-3 pr-16 rounded-lg border border-input bg-background text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono uppercase text-muted-foreground pointer-events-none">days</span>
          </div>
        </label>
      </section>

      <section className="bg-card rounded-2xl border border-border p-6">
        <label className="flex items-start gap-3 cursor-pointer">
          <input type="checkbox" checked={form.scribe_enabled} onChange={(e) => setForm({ ...form, scribe_enabled: e.target.checked })} className="mt-1 rounded" />
          <div>
            <div className="font-medium">AI Scribe enabled practice-wide</div>
            <div className="text-xs text-muted-foreground mt-1">When disabled, providers cannot start new sessions. Existing sessions and drafts remain accessible.</div>
          </div>
        </label>
      </section>

      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm p-3">{error}</div>
      )}
      {success && (
        <div className="rounded-lg bg-green-50 dark:bg-green-950 border border-green-300 dark:border-green-800 text-green-900 dark:text-green-100 text-sm p-3 flex items-center gap-2">
          <Check className="h-4 w-4" /> Settings saved
        </div>
      )}

      <div className="flex items-center justify-end">
        <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 h-10 px-5 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-accent transition-colors disabled:opacity-50">
          {saving ? 'Saving…' : 'Save settings'}
        </button>
      </div>
    </div>
  );
}

function ModelCard({ value, current, onSelect, name, description, cost }: { value: 'claude' | 'gpt4o'; current: string; onSelect: (v: 'claude' | 'gpt4o') => void; name: string; description: string; cost: string }) {
  const active = current === value;
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className={`text-left p-4 rounded-lg border transition-colors ${active ? 'bg-primary/5 border-primary' : 'bg-card border-input hover:bg-muted'}`}
    >
      <div className="font-medium">{name}</div>
      <div className="text-xs text-muted-foreground mt-1">{description}</div>
      <div className="text-[10px] font-mono text-muted-foreground mt-2">{cost}</div>
    </button>
  );
}
