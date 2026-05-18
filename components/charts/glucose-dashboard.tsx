'use client';

import { useState, useMemo } from 'react';
import { Activity, RefreshCw, AlertTriangle, Trash2, Settings as SettingsIcon, ChevronRight } from 'lucide-react';
import { computeCgmStats, rangePreset, filterByRange, type CgmReading, type CgmThresholds, DEFAULT_THRESHOLDS } from '@/lib/cgm/analytics';
import { AgpChart } from './agp-chart';
import { TirBar } from './tir-bar';
import { formatDateTime } from '@/lib/utils';

type Connection = {
  id: string;
  device: string;
  is_active: boolean;
  last_synced_at: string | null;
  token_expires_at: string | null;
  sync_status: 'idle' | 'syncing' | 'error';
  last_error: string | null;
  consecutive_failures: number;
};

type Period = '14d' | '30d' | '90d';

export function GlucoseDashboard({
  patientId,
  connection,
  readings: initialReadings,
  thresholds: thresholdsRow,
  onDisconnect,
}: {
  patientId: string;
  connection: Connection | null;
  readings: CgmReading[];
  thresholds?: any;
  onDisconnect?: () => void;
}) {
  const [period, setPeriod] = useState<Period>('14d');
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [readings, setReadings] = useState(initialReadings);

  const thresholds: CgmThresholds = thresholdsRow
    ? {
        targetLow: Number(thresholdsRow.target_low),
        targetHigh: Number(thresholdsRow.target_high),
        urgentLow: Number(thresholdsRow.urgent_low),
        urgentHigh: Number(thresholdsRow.urgent_high),
      }
    : DEFAULT_THRESHOLDS;

  const { current, prior14d, prior30d } = useMemo(() => {
    const { start: s14, end } = rangePreset(period);
    const filtered = filterByRange(readings, s14, end);
    const current = computeCgmStats(filtered, s14, end, thresholds);

    // Prior period for comparison
    const priorEnd = new Date(s14);
    const priorStart = new Date(s14);
    const days = period === '14d' ? 14 : period === '30d' ? 30 : 90;
    priorStart.setDate(priorStart.getDate() - days);
    const priorFiltered = filterByRange(readings, priorStart, priorEnd);
    const prior = computeCgmStats(priorFiltered, priorStart, priorEnd, thresholds);

    return { current, prior14d: prior, prior30d: prior };
  }, [readings, period, thresholds]);

  async function handleSync() {
    if (!connection) return;
    setSyncing(true);
    setSyncMessage(null);
    try {
      const res = await fetch(`/api/cgm/connections/${connection.id}/sync`, { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        setSyncMessage(`✓ Synced ${data.readingsInserted} new readings (${data.alertsCreated} alerts)`);
        // Reload readings for the current page
        window.location.reload();
      } else {
        setSyncMessage(`Sync failed: ${data.error}`);
      }
    } catch (err) {
      setSyncMessage(`Network error: ${(err as Error).message}`);
    } finally {
      setSyncing(false);
    }
  }

  async function handleDisconnect() {
    if (!connection) return;
    if (!confirm('Disconnect this CGM? Historical readings will be preserved.')) return;
    try {
      const res = await fetch(`/api/cgm/connections/${connection.id}/sync`, { method: 'DELETE' });
      if (res.ok) {
        onDisconnect?.();
        window.location.reload();
      }
    } catch {}
  }

  // No connection — show connect CTA
  if (!connection) {
    return (
      <section className="bg-card rounded-2xl border border-border">
        <header className="px-6 py-5 border-b border-border flex items-center justify-between">
          <h2 className="font-display text-xl flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" /> Continuous Glucose Monitor
          </h2>
        </header>
        <div className="px-6 py-12 text-center">
          <Activity className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="font-display text-lg">No CGM connected</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
            Connect this patient&rsquo;s Dexcom G6/G7 to see time-in-range, glucose variability, and AGP reports inline with their chart.
          </p>
          <a
            href={`/app/cgm/connect?patient=${patientId}`}
            className="inline-flex items-center gap-2 mt-6 h-10 px-5 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-accent transition-colors"
          >
            <Activity className="h-4 w-4" /> Connect CGM
          </a>
        </div>
      </section>
    );
  }

  // Connected - show full dashboard
  return (
    <section className="bg-card rounded-2xl border border-border">
      <header className="px-6 py-5 border-b border-border flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Activity className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-display text-xl">Continuous Glucose Monitor</h2>
          <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground px-2 py-0.5 rounded bg-muted">
            {connection.device.replace('_', ' ')}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <PeriodPill value="14d" current={period} onSelect={setPeriod} label="14 days" />
          <PeriodPill value="30d" current={period} onSelect={setPeriod} label="30 days" />
          <PeriodPill value="90d" current={period} onSelect={setPeriod} label="90 days" />
          <button
            onClick={handleSync}
            disabled={syncing}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full border border-input bg-card text-xs font-medium hover:bg-muted transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3 w-3 ${syncing ? 'animate-spin' : ''}`} /> Sync
          </button>
          <a
            href={`/app/patients/${patientId}/cgm-settings`}
            className="inline-flex items-center justify-center h-8 w-8 rounded-full border border-input bg-card text-muted-foreground hover:bg-muted transition-colors"
            title="CGM settings"
          >
            <SettingsIcon className="h-3.5 w-3.5" />
          </a>
          <button
            onClick={handleDisconnect}
            className="inline-flex items-center justify-center h-8 w-8 rounded-full border border-input bg-card text-muted-foreground hover:text-destructive transition-colors"
            title="Disconnect"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      {connection.last_error && (
        <div className="mx-6 mt-4 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs p-3 flex items-start gap-2">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <div>
            <strong>Last sync failed.</strong> {connection.last_error}
            {connection.consecutive_failures > 5 && (
              <span> · Patient may need to re-authorize Dexcom.</span>
            )}
          </div>
        </div>
      )}

      {syncMessage && (
        <div className="mx-6 mt-4 rounded-lg bg-muted text-sm p-3">{syncMessage}</div>
      )}

      <div className="px-6 py-5 grid lg:grid-cols-4 gap-4">
        <StatTile label="Mean glucose" value={current.meanGlucose !== null ? `${Math.round(current.meanGlucose)}` : '—'} unit="mg/dL" delta={current.meanGlucose && prior14d.meanGlucose ? current.meanGlucose - prior14d.meanGlucose : null} deltaUnit="mg/dL" inverted />
        <StatTile label="GMI (est A1C)" value={current.gmi !== null ? `${current.gmi.toFixed(1)}` : '—'} unit="%" delta={current.gmi && prior14d.gmi ? current.gmi - prior14d.gmi : null} deltaUnit="%" inverted />
        <StatTile label="Time in range" value={current.tir.range > 0 ? `${current.tir.range.toFixed(0)}` : '—'} unit="%" target=">70%" delta={prior14d.tir.range ? current.tir.range - prior14d.tir.range : null} deltaUnit="pp" />
        <StatTile label="Variability (CV)" value={current.cv !== null ? `${current.cv.toFixed(0)}` : '—'} unit="%" target="<36%" delta={current.cv && prior14d.cv ? current.cv - prior14d.cv : null} deltaUnit="pp" inverted />
      </div>

      <div className="px-6 pb-2">
        <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">Time in Range</div>
        <TirBar stats={current} />
      </div>

      <div className="px-2 py-2">
        <div className="px-4 mb-1 text-xs font-mono uppercase tracking-wider text-muted-foreground">Ambulatory Glucose Profile</div>
        <AgpChart
          readings={filterByRange(readings, rangePreset(period).start, rangePreset(period).end)}
          targetLow={thresholds.targetLow}
          targetHigh={thresholds.targetHigh}
          urgentLow={thresholds.urgentLow}
          urgentHigh={thresholds.urgentHigh}
        />
      </div>

      <footer className="px-6 py-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
        <span>{current.count.toLocaleString()} readings · {(current.coverage * 100).toFixed(0)}% coverage</span>
        <span>Last sync: {connection.last_synced_at ? formatDateTime(connection.last_synced_at) : 'Never'}</span>
      </footer>
    </section>
  );
}

function PeriodPill({ value, current, onSelect, label }: { value: Period; current: Period; onSelect: (p: Period) => void; label: string }) {
  const active = value === current;
  return (
    <button
      onClick={() => onSelect(value)}
      className={`h-8 px-3 rounded-full text-xs font-mono uppercase tracking-wider transition-colors ${
        active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground'
      }`}
    >
      {label}
    </button>
  );
}

function StatTile({
  label,
  value,
  unit,
  target,
  delta,
  deltaUnit,
  inverted,
}: {
  label: string;
  value: string;
  unit: string;
  target?: string;
  delta?: number | null;
  deltaUnit?: string;
  inverted?: boolean;
}) {
  // For inverted metrics (mean glucose, GMI, CV), a decrease is good
  let deltaColor = 'text-muted-foreground';
  let deltaSign = '';
  if (delta !== null && delta !== undefined && Math.abs(delta) >= 0.1) {
    const isGood = inverted ? delta < 0 : delta > 0;
    deltaColor = isGood ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300';
    deltaSign = delta > 0 ? '+' : '';
  }

  return (
    <div className="rounded-lg border border-border p-4 bg-card">
      <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-display text-3xl tabular-nums mt-1">
        {value}
        <span className="text-sm text-muted-foreground ml-1">{unit}</span>
      </div>
      <div className="flex items-center justify-between mt-1 text-xs">
        {target && <span className="text-muted-foreground font-mono">{target}</span>}
        {delta !== null && delta !== undefined && Math.abs(delta) >= 0.1 && (
          <span className={`font-mono tabular-nums ${deltaColor}`}>
            {deltaSign}{delta.toFixed(1)} {deltaUnit}
          </span>
        )}
      </div>
    </div>
  );
}
