'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, X, UserCheck, Activity, Trash2, Loader2 } from 'lucide-react';

export function AppointmentActions({ appointment, currentUserId }: { appointment: any; currentUserId: string }) {
  const router = useRouter();
  const [working, setWorking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function setStatus(status: string, extra: any = {}) {
    setWorking(status);
    setError(null);
    try {
      const res = await fetch(`/api/appointments/${appointment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, ...extra }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? 'Update failed');
        return;
      }
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setWorking(null);
    }
  }

  async function cancel() {
    const reason = window.prompt('Cancellation reason (optional):');
    if (reason === null) return;
    await setStatus('cancelled', { cancellation_reason: reason });
  }

  async function softDelete() {
    if (!confirm('Delete this appointment? Pending SMS reminders will be cancelled.')) return;
    setWorking('delete');
    try {
      const res = await fetch(`/api/appointments/${appointment.id}`, { method: 'DELETE' });
      if (res.ok) router.push('/app/schedule');
    } finally {
      setWorking(null);
    }
  }

  const status = appointment.status;
  const isFinal = ['completed', 'cancelled', 'no_show'].includes(status);

  return (
    <section className="bg-card rounded-2xl border border-border p-5 space-y-3">
      <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Workflow</div>
      <div className="flex items-center gap-2 flex-wrap">
        {status === 'scheduled' && (
          <button onClick={() => setStatus('confirmed')} disabled={working !== null} className="action-btn">
            {working === 'confirmed' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Mark confirmed
          </button>
        )}
        {['scheduled', 'confirmed'].includes(status) && (
          <button onClick={() => setStatus('arrived')} disabled={working !== null} className="action-btn">
            {working === 'arrived' ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4" />}
            Patient arrived
          </button>
        )}
        {['arrived', 'confirmed', 'scheduled'].includes(status) && (
          <button onClick={() => setStatus('in_progress')} disabled={working !== null} className="action-btn">
            {working === 'in_progress' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />}
            Start visit
          </button>
        )}
        {['in_progress', 'arrived'].includes(status) && (
          <button onClick={() => setStatus('completed')} disabled={working !== null} className="action-btn action-btn-primary">
            {working === 'completed' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Mark complete
          </button>
        )}
        {!isFinal && (
          <>
            <button onClick={() => setStatus('no_show')} disabled={working !== null} className="action-btn action-btn-danger">
              {working === 'no_show' ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
              No-show
            </button>
            <button onClick={cancel} disabled={working !== null} className="action-btn action-btn-danger">
              <X className="h-4 w-4" /> Cancel
            </button>
          </>
        )}
        <button onClick={softDelete} disabled={working !== null} className="action-btn ml-auto">
          <Trash2 className="h-4 w-4" /> Delete
        </button>
      </div>
      {error && <div className="text-sm text-destructive">{error}</div>}
      <style jsx>{`
        :global(.action-btn) {
          display: inline-flex; align-items: center; gap: 6px;
          height: 36px; padding: 0 14px;
          border-radius: 999px;
          border: 1px solid hsl(var(--input));
          background: hsl(var(--card));
          font-size: 13px; font-weight: 500;
          transition: background-color 150ms;
          cursor: pointer;
        }
        :global(.action-btn:hover:not(:disabled)) { background: hsl(var(--muted)); }
        :global(.action-btn:disabled) { opacity: 0.5; cursor: not-allowed; }
        :global(.action-btn-primary) {
          background: hsl(var(--primary)); color: hsl(var(--primary-foreground));
          border-color: transparent;
        }
        :global(.action-btn-primary:hover:not(:disabled)) { background: hsl(var(--accent)); }
        :global(.action-btn-danger) {
          color: hsl(var(--destructive));
          border-color: hsl(var(--destructive) / 0.3);
        }
        :global(.action-btn-danger:hover:not(:disabled)) { background: hsl(var(--destructive) / 0.1); }
      `}</style>
    </section>
  );
}
