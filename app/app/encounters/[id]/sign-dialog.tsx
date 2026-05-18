'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { FileSignature, X, Lock } from 'lucide-react';

export function SignDialog({
  encounterId,
  onSigned,
  onCancel,
}: {
  encounterId: string;
  onSigned: () => void;
  onCancel: () => void;
}) {
  const [pin, setPin] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsPin, setNeedsPin] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pin.length < 4) {
      setError('PIN must be 4-6 digits');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/encounters/${encounterId}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });
      if (res.ok) {
        onSigned();
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (res.status === 412 && data.error === 'no_pin_set') {
        setNeedsPin(true);
        return;
      }
      setError(data.error ?? data.message ?? 'Could not sign');
    } catch {
      setError('Network error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4" onClick={onCancel}>
      <div className="bg-card rounded-2xl border border-border w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <header className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h2 className="font-display text-lg flex items-center gap-2">
            <FileSignature className="h-5 w-5" /> Sign encounter
          </h2>
          <button onClick={onCancel} className="text-muted-foreground hover:text-foreground" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </header>
        {needsPin ? (
          <div className="px-6 py-6 space-y-4 text-center">
            <Lock className="h-10 w-10 mx-auto text-muted-foreground" />
            <div className="space-y-1">
              <div className="font-display text-lg">Set a sign PIN first</div>
              <p className="text-sm text-muted-foreground">
                You need to set a 4-6 digit signing PIN before you can sign encounters.
              </p>
            </div>
            <Link href="/app/settings/sign-pin" className="inline-block h-10 px-5 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-accent transition-colors leading-10">
              Set up sign PIN →
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="px-6 py-5 space-y-4">
            <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
              <p><strong>Signing locks this encounter permanently.</strong></p>
              <p>The encounter content will become immutable. To make changes later you'll need to create an amendment.</p>
            </div>
            <label className="block space-y-1.5">
              <div className="text-xs font-medium uppercase tracking-wider">Your sign PIN</div>
              <input
                ref={inputRef}
                type="password"
                inputMode="numeric"
                pattern="\d{4,6}"
                maxLength={6}
                required
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                placeholder="••••"
                className="w-full h-11 px-4 rounded-lg border border-input bg-background text-lg tabular-nums tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
            {error && <div className="text-sm text-destructive">{error}</div>}
            <div className="flex gap-2">
              <button type="button" onClick={onCancel} className="flex-1 h-10 rounded-lg border border-input bg-card text-sm font-medium hover:bg-muted transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={submitting || pin.length < 4} className="flex-1 h-10 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-accent transition-colors disabled:opacity-50">
                {submitting ? 'Signing…' : 'Sign & lock'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
