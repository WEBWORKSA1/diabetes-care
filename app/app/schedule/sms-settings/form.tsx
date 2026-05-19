'use client';

import { useState } from 'react';
import { Save, Check, Lock, Loader2, AlertCircle } from 'lucide-react';

export function SmsSettingsForm({ initial }: { initial: any }) {
  const isOwner = initial.role === 'owner';
  const [form, setForm] = useState({
    sms_enabled: initial.sms_enabled ?? true,
    sms_24h_reminder_enabled: initial.sms_24h_reminder_enabled ?? true,
    sms_2h_reminder_enabled: initial.sms_2h_reminder_enabled ?? true,
    sms_from_name: initial.sms_from_name ?? initial.name ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    setSuccess(false);
    setSaving(true);
    try {
      const res = await fetch('/api/organization/sms-settings', {
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

  if (!isOwner) {
    return (
      <div className="rounded-lg bg-muted/50 p-6 text-center space-y-3">
        <Lock className="h-8 w-8 mx-auto text-muted-foreground/60" />
        <p className="font-display text-lg">Owner only</p>
        <p className="text-sm text-muted-foreground">Only practice owners can change SMS settings.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="bg-card rounded-2xl border border-border p-5">
        <label className="flex items-start gap-3 cursor-pointer">
          <input type="checkbox" checked={form.sms_enabled} onChange={(e) => setForm({ ...form, sms_enabled: e.target.checked })} className="mt-1 rounded" />
          <div>
            <div className="font-medium">SMS reminders enabled</div>
            <div className="text-xs text-muted-foreground mt-1">When disabled, no SMS reminders are sent for any appointment.</div>
          </div>
        </label>
      </section>

      {form.sms_enabled && (
        <>
          <section className="bg-card rounded-2xl border border-border p-5 space-y-4">
            <h2 className="font-display text-lg">Reminder cadence</h2>
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={form.sms_24h_reminder_enabled} onChange={(e) => setForm({ ...form, sms_24h_reminder_enabled: e.target.checked })} className="mt-1 rounded" />
              <div>
                <div className="font-medium">24-hour reminder</div>
                <div className="text-xs text-muted-foreground">Sent the day before the appointment. Includes a cancellation link.</div>
              </div>
            </label>
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={form.sms_2h_reminder_enabled} onChange={(e) => setForm({ ...form, sms_2h_reminder_enabled: e.target.checked })} className="mt-1 rounded" />
              <div>
                <div className="font-medium">2-hour reminder</div>
                <div className="text-xs text-muted-foreground">A short confirmation 2 hours before the appointment.</div>
              </div>
            </label>
          </section>

          <section className="bg-card rounded-2xl border border-border p-5 space-y-3">
            <h2 className="font-display text-lg">Sender identity</h2>
            <label className="block space-y-1.5">
              <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Practice name shown in messages</div>
              <input
                type="text"
                value={form.sms_from_name}
                onChange={(e) => setForm({ ...form, sms_from_name: e.target.value })}
                className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm"
                placeholder="e.g. Pinecrest Endocrinology"
              />
              <div className="text-xs text-muted-foreground">Used in reminder text like: &quot;…appointment at <strong>{form.sms_from_name || 'Practice name'}</strong>…&quot;</div>
            </label>
          </section>

          <section className="bg-amber-50 dark:bg-amber-950 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-100 rounded-lg p-4 text-xs flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <strong>HIPAA reminder.</strong> SMS reminders only contain non-PHI elements (patient first name, provider last name, date/time, practice name). Twilio must have a signed BAA before going live with real patient data.
            </div>
          </section>
        </>
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
          Save SMS settings
        </button>
      </div>
    </div>
  );
}
