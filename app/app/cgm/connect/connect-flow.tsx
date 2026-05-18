'use client';

import { useState } from 'react';
import { Activity, AlertCircle, ExternalLink } from 'lucide-react';

export function ConnectFlow({ patient }: { patient: any }) {
  const [device, setDevice] = useState<'dexcom_g7' | 'dexcom_g6'>('dexcom_g7');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/cgm/oauth/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patient_id: patient.id, device }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Could not start OAuth flow');
        setSubmitting(false);
        return;
      }
      // Redirect to Dexcom for patient authorization
      window.location.href = data.authorization_url;
    } catch (err) {
      setError('Network error: ' + (err as Error).message);
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="bg-card rounded-2xl border border-border p-6 space-y-4">
        <h2 className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Step 1 · Select device</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <DeviceCard
            value="dexcom_g7"
            current={device}
            onSelect={setDevice}
            name="Dexcom G7"
            description="Latest generation, 10-day wear"
          />
          <DeviceCard
            value="dexcom_g6"
            current={device}
            onSelect={setDevice}
            name="Dexcom G6"
            description="10-day wear, requires transmitter"
          />
        </div>
      </section>

      <section className="bg-card rounded-2xl border border-border p-6 space-y-4">
        <h2 className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Step 2 · Patient authorization</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          When you click <strong className="text-foreground">Authorize</strong>, you (or your patient) will be redirected to Dexcom&rsquo;s login page.
          The patient signs in with <strong className="text-foreground">their own Dexcom account credentials</strong> and grants this practice access to read their CGM data.
        </p>
        <div className="rounded-lg bg-muted/50 p-4 text-xs space-y-2">
          <p className="font-medium">Important:</p>
          <ul className="list-disc list-inside text-muted-foreground space-y-1">
            <li>Patient should be present at this device, or you should hand them the device for the Dexcom login step.</li>
            <li>Data syncs every hour automatically. Initial sync pulls 90 days of history.</li>
            <li>You can disconnect at any time. Historical readings are retained.</li>
          </ul>
        </div>
      </section>

      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm p-3 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <div>{error}</div>
        </div>
      )}

      <div className="flex items-center justify-end">
        <button
          onClick={start}
          disabled={submitting}
          className="inline-flex items-center gap-2 h-11 px-6 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-accent transition-colors disabled:opacity-50"
        >
          {submitting ? 'Redirecting…' : 'Authorize with Dexcom'}
          <ExternalLink className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function DeviceCard({ value, current, onSelect, name, description }: { value: 'dexcom_g7' | 'dexcom_g6'; current: string; onSelect: (v: 'dexcom_g7' | 'dexcom_g6') => void; name: string; description: string }) {
  const active = current === value;
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className={`text-left p-4 rounded-lg border transition-colors ${
        active ? 'bg-primary/5 border-primary' : 'bg-card border-input hover:bg-muted'
      }`}
    >
      <div className="flex items-center gap-2">
        <Activity className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">{name}</span>
      </div>
      <p className="text-xs text-muted-foreground mt-1">{description}</p>
    </button>
  );
}
