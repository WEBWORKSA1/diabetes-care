'use client';

import { useState, useEffect } from 'react';
import { Check } from 'lucide-react';

export function SignPinForm() {
  const [hasPin, setHasPin] = useState<boolean | null>(null);
  const [setAt, setSetAt] = useState<string | null>(null);
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetch('/api/settings/sign-pin')
      .then((r) => r.json())
      .then((d) => {
        setHasPin(!!d.has_pin);
        setSetAt(d.set_at);
      })
      .catch(() => setHasPin(false));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (newPin.length < 4 || newPin.length > 6) {
      setError('PIN must be 4-6 digits');
      return;
    }
    if (!/^\d+$/.test(newPin)) {
      setError('PIN must be digits only');
      return;
    }
    if (newPin !== confirmPin) {
      setError('PINs do not match');
      return;
    }

    setSubmitting(true);
    try {
      const body: any = { pin: newPin };
      if (hasPin) body.current_pin = currentPin;
      const res = await fetch('/api/settings/sign-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'Could not save PIN');
        setSubmitting(false);
        return;
      }
      setSuccess(true);
      setHasPin(true);
      setSetAt(new Date().toISOString());
      setCurrentPin('');
      setNewPin('');
      setConfirmPin('');
    } catch {
      setError('Network error');
    } finally {
      setSubmitting(false);
    }
  }

  if (hasPin === null) {
    return <div className="text-sm text-muted-foreground">Loading…</div>;
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      {hasPin && (
        <div className="rounded-lg bg-muted/50 p-4 text-sm">
          <div className="font-medium flex items-center gap-2 mb-1">
            <Check className="h-4 w-4 text-green-600" /> PIN set
          </div>
          {setAt && (
            <div className="text-xs text-muted-foreground font-mono">
              Last set {new Date(setAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
            </div>
          )}
        </div>
      )}

      {hasPin && (
        <label className="block space-y-1.5">
          <div className="text-sm font-medium">Current PIN</div>
          <input type="password" inputMode="numeric" pattern="\d{4,6}" maxLength={6} required value={currentPin} onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ''))} className="w-full h-11 px-4 rounded-lg border border-input bg-background text-lg tabular-nums tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-ring" placeholder="••••" />
        </label>
      )}

      <label className="block space-y-1.5">
        <div className="text-sm font-medium">{hasPin ? 'New PIN' : 'Set PIN'}</div>
        <input type="password" inputMode="numeric" pattern="\d{4,6}" maxLength={6} required autoComplete="new-password" value={newPin} onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))} className="w-full h-11 px-4 rounded-lg border border-input bg-background text-lg tabular-nums tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-ring" placeholder="4-6 digits" />
      </label>

      <label className="block space-y-1.5">
        <div className="text-sm font-medium">Confirm PIN</div>
        <input type="password" inputMode="numeric" pattern="\d{4,6}" maxLength={6} required autoComplete="new-password" value={confirmPin} onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))} className="w-full h-11 px-4 rounded-lg border border-input bg-background text-lg tabular-nums tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-ring" placeholder="Re-enter" />
      </label>

      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm p-3">{error}</div>
      )}

      {success && (
        <div className="rounded-lg bg-green-50 dark:bg-green-950 border border-green-300 dark:border-green-800 text-green-900 dark:text-green-100 text-sm p-3 flex items-center gap-2">
          <Check className="h-4 w-4" /> PIN {hasPin ? 'changed' : 'set'} successfully
        </div>
      )}

      <button type="submit" disabled={submitting} className="w-full h-11 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-accent transition-colors disabled:opacity-50">
        {submitting ? 'Saving…' : hasPin ? 'Change PIN' : 'Set PIN'}
      </button>

      <div className="text-xs text-muted-foreground space-y-1 pt-4 border-t border-border">
        <p><strong className="text-foreground">Security notes:</strong></p>
        <ul className="list-disc list-inside space-y-0.5">
          <li>PIN is stored as a salted scrypt hash, never plaintext.</li>
          <li>Choose a PIN you can remember — there is no recovery flow yet (Sprint 7).</li>
          <li>Failed PIN attempts are logged for audit.</li>
        </ul>
      </div>
    </form>
  );
}
