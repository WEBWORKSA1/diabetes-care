'use client';

import { useState } from 'react';
import { Save, Check, Lock, Loader2 } from 'lucide-react';

export function PortalSettingsForm({ initial }: { initial: any }) {
  const isOwner = initial.role === 'owner';
  const [form, setForm] = useState({
    portal_enabled: initial.portal_enabled ?? false,
    portal_emergency_text: initial.portal_emergency_text ?? 'If this is a medical emergency, call 911 or go to your nearest emergency room. Do not use this portal for urgent issues.',
  });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    setSuccess(false);
    setSaving(true);
    try {
      const res = await fetch('/api/organization/portal-settings', {
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
    } finally {
      setSaving(false);
    }
  }

  if (!isOwner) {
    return (
      <div className="rounded-lg bg-muted/50 p-6 text-center space-y-3">
        <Lock className="h-8 w-8 mx-auto text-muted-foreground/60" />
        <p className="font-display text-lg">Owner only</p>
        <p className="text-sm text-muted-foreground">Only practice owners can change portal settings.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="bg-card rounded-2xl border border-border p-5">
        <label className="flex items-start gap-3 cursor-pointer">
          <input type="checkbox" checked={form.portal_enabled} onChange={(e) => setForm({ ...form, portal_enabled: e.target.checked })} className="mt-1 rounded" />
          <div>
            <div className="font-medium">Patient portal enabled</div>
            <div className="text-xs text-muted-foreground mt-1">
              When enabled, you can send patients magic links to access their portal. Patients see lab results, upcoming visits, and can fill out intake forms or send routine messages.
            </div>
          </div>
        </label>
      </section>

      {form.portal_enabled && (
        <section className="bg-card rounded-2xl border border-border p-5 space-y-3">
          <h2 className="font-display text-lg">Emergency disclaimer</h2>
          <p className="text-xs text-muted-foreground">Shown at the top of every portal page so patients don&rsquo;t use it for emergencies.</p>
          <textarea
            value={form.portal_emergency_text}
            onChange={(e) => setForm({ ...form, portal_emergency_text: e.target.value })}
            rows={3}
            maxLength={500}
            className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm resize-y"
          />
          <div className="text-[10px] font-mono text-muted-foreground text-right">{form.portal_emergency_text.length} / 500</div>
        </section>
      )}

      {error && <div className="rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm p-3">{error}</div>}
      {success && (
        <div className="rounded-lg bg-green-50 dark:bg-green-950 border border-green-300 dark:border-green-800 text-green-900 dark:text-green-100 text-sm p-3 flex items-center gap-2">
          <Check className="h-4 w-4" /> Settings saved
        </div>
      )}

      <div className="flex justify-end">
        <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 h-10 px-5 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-accent transition-colors disabled:opacity-50">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save settings
        </button>
      </div>
    </div>
  );
}
