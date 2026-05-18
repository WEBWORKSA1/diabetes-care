'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, CheckCircle2, X, AlertCircle, Info } from 'lucide-react';
import { formatDateTime } from '@/lib/utils';

type Alert = {
  id: string;
  alert_type: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string | null;
  detected_at: string;
  observation_window_start: string | null;
  observation_window_end: string | null;
  context: Record<string, any>;
  acknowledged_at: string | null;
  resolved_at: string | null;
};

export function AlertsPanel({ alerts: initial }: { alerts: Alert[] }) {
  const router = useRouter();
  const [alerts, setAlerts] = useState(initial);
  const [processing, setProcessing] = useState<string | null>(null);

  const unresolved = alerts.filter((a) => !a.resolved_at);

  async function ack(id: string) {
    setProcessing(id);
    try {
      const res = await fetch(`/api/cgm/alerts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acknowledged: true }),
      });
      if (res.ok) {
        setAlerts((prev) => prev.map((a) => a.id === id ? { ...a, acknowledged_at: new Date().toISOString() } : a));
      }
    } finally {
      setProcessing(null);
    }
  }

  async function resolve(id: string) {
    const note = window.prompt('Optional resolution note:');
    if (note === null) return;
    setProcessing(id);
    try {
      const res = await fetch(`/api/cgm/alerts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolved: true, resolution_note: note }),
      });
      if (res.ok) {
        setAlerts((prev) => prev.map((a) => a.id === id ? { ...a, resolved_at: new Date().toISOString() } : a));
      }
    } finally {
      setProcessing(null);
    }
  }

  if (unresolved.length === 0) {
    return (
      <section className="bg-card rounded-2xl border border-border">
        <header className="px-6 py-5 border-b border-border">
          <h2 className="font-display text-xl flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600" /> CGM Alerts
          </h2>
        </header>
        <div className="px-6 py-8 text-center text-sm text-muted-foreground">
          No active alerts. CGM data is within thresholds.
        </div>
      </section>
    );
  }

  return (
    <section className="bg-card rounded-2xl border border-border">
      <header className="px-6 py-5 border-b border-border flex items-center justify-between">
        <h2 className="font-display text-xl flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600" /> CGM Alerts
        </h2>
        <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
          {unresolved.length} active
        </span>
      </header>
      <ul className="divide-y divide-border">
        {unresolved.map((a) => (
          <li key={a.id} className="px-6 py-4">
            <div className="flex items-start gap-3">
              <SeverityIcon severity={a.severity} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="font-medium text-sm">{a.title}</div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                    {formatDateTime(a.detected_at)}
                  </span>
                </div>
                {a.description && (
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{a.description}</p>
                )}
                <div className="flex items-center gap-2 mt-2">
                  {!a.acknowledged_at && (
                    <button
                      onClick={() => ack(a.id)}
                      disabled={processing === a.id}
                      className="text-xs font-mono uppercase tracking-wider px-2 py-1 rounded border border-input hover:bg-muted transition-colors disabled:opacity-50"
                    >
                      Acknowledge
                    </button>
                  )}
                  {a.acknowledged_at && (
                    <span className="text-[10px] font-mono uppercase tracking-wider text-green-700 dark:text-green-300">
                      ✓ Acknowledged
                    </span>
                  )}
                  <button
                    onClick={() => resolve(a.id)}
                    disabled={processing === a.id}
                    className="text-xs font-mono uppercase tracking-wider px-2 py-1 rounded border border-input hover:bg-muted transition-colors disabled:opacity-50"
                  >
                    Resolve
                  </button>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function SeverityIcon({ severity }: { severity: 'info' | 'warning' | 'critical' }) {
  if (severity === 'critical') return <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />;
  if (severity === 'warning') return <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />;
  return <Info className="h-5 w-5 text-muted-foreground shrink-0" />;
}
