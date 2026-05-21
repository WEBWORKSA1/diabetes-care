'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Loader2 } from 'lucide-react';

export function ReviewActions({ responseId }: { responseId: string }) {
  const router = useRouter();
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function markReviewed() {
    const notes = window.prompt('Optional review notes:');
    if (notes === null) return;
    setWorking(true);
    setError(null);
    try {
      const res = await fetch(`/api/intake-forms/responses/${responseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'reviewed', review_notes: notes }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? 'Update failed');
        return;
      }
      router.refresh();
    } finally {
      setWorking(false);
    }
  }

  return (
    <section className="bg-card rounded-2xl border border-border p-5 flex items-center justify-end gap-3">
      {error && <p className="text-sm text-destructive flex-1">{error}</p>}
      <button
        onClick={markReviewed}
        disabled={working}
        className="inline-flex items-center gap-2 h-10 px-5 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-accent transition-colors disabled:opacity-50"
      >
        {working ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        Mark reviewed
      </button>
    </section>
  );
}
