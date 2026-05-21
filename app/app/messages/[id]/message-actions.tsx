'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Loader2, Phone } from 'lucide-react';

export function MessageActions({ message }: { message: any }) {
  const router = useRouter();
  const [working, setWorking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function patch(update: any, label: string) {
    setWorking(label);
    setError(null);
    try {
      const res = await fetch(`/api/patient-messages/${message.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(update),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? 'Update failed');
        return;
      }
      router.refresh();
    } finally {
      setWorking(null);
    }
  }

  async function acknowledge() {
    await patch({ acknowledged: true }, 'ack');
  }

  async function resolve() {
    const note = window.prompt('Resolution note (optional):');
    if (note === null) return;
    await patch({ resolved: true, resolution_note: note }, 'resolve');
  }

  return (
    <section className="bg-card rounded-2xl border border-border p-5 space-y-3">
      <h2 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Actions</h2>
      <div className="flex items-center gap-2 flex-wrap">
        {!message.acknowledged_at && !message.resolved_at && (
          <button onClick={acknowledge} disabled={working !== null} className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full border border-input bg-card text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50">
            {working === 'ack' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            Acknowledge
          </button>
        )}
        {!message.resolved_at && (
          <button onClick={resolve} disabled={working !== null} className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-accent transition-colors disabled:opacity-50">
            {working === 'resolve' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            Mark resolved
          </button>
        )}
        {message.patients?.phone_mobile && (
          <a href={`tel:${message.patients.phone_mobile}`} className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full border border-input bg-card text-sm font-medium hover:bg-muted transition-colors">
            <Phone className="h-3.5 w-3.5" /> Call patient
          </a>
        )}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </section>
  );
}
