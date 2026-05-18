'use client';

import { AlertTriangle, Check, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { patternLabel, type PatternType } from '@/lib/clinical/cgm-patterns';
import { formatDateTime } from '@/lib/utils';

export interface PatternRow {
  id: string;
  pattern_type: PatternType;
  severity: 'mild' | 'moderate' | 'severe';
  detected_at: string;
  period_start: string;
  period_end: string;
  details: Record<string, any>;
  acknowledged_at: string | null;
}

export function PatternAlerts({
  patterns,
  onAcknowledged,
}: {
  patterns: PatternRow[];
  onAcknowledged?: (id: string) => void;
}) {
  const router = useRouter();
  const [acking, setAcking] = useState<string | null>(null);

  const unacked = patterns.filter((p) => !p.acknowledged_at);
  const acked = patterns.filter((p) => p.acknowledged_at);

  async function acknowledge(id: string) {
    setAcking(id);
    try {
      const res = await fetch(`/api/cgm/patterns/${id}/acknowledge`, { method: 'POST' });
      if (res.ok) {
        onAcknowledged?.(id);
        router.refresh();
      }
    } finally {
      setAcking(null);
    }
  }

  if (patterns.length === 0) {
    return (
      <div className="px-6 py-8 text-center text-sm text-muted-foreground">
        No patterns flagged. Run a sync to detect glucose patterns.
      </div>
    );
  }

  return (
    <div className="space-y-3 p-4">
      {unacked.length > 0 && (
        <div className="space-y-2">
          <div className="px-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            New alerts ({unacked.length})
          </div>
          {unacked.map((p) => (
            <PatternCard
              key={p.id}
              pattern={p}
              acking={acking === p.id}
              onAcknowledge={() => acknowledge(p.id)}
            />
          ))}
        </div>
      )}

      {acked.length > 0 && (
        <details className="pt-2">
          <summary className="px-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-foreground">
            Acknowledged ({acked.length})
          </summary>
          <div className="mt-2 space-y-2">
            {acked.map((p) => (
              <PatternCard key={p.id} pattern={p} compact />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function PatternCard({
  pattern,
  acking,
  onAcknowledge,
  compact,
}: {
  pattern: PatternRow;
  acking?: boolean;
  onAcknowledge?: () => void;
  compact?: boolean;
}) {
  const sevTone = pattern.severity === 'severe' ? 'high' : pattern.severity === 'moderate' ? 'borderline' : 'good';
  const description = pattern.details?.description ?? renderDescription(pattern);

  return (
    <div className={`rounded-xl border p-3 ${
      compact
        ? 'border-border bg-muted/30 opacity-70'
        : pattern.severity === 'severe'
          ? 'border-red-300 bg-red-50/40 dark:bg-red-950/20 dark:border-red-900'
          : 'border-border bg-card'
    }`}>
      <div className="flex items-start gap-3">
        <AlertTriangle className={`h-4 w-4 mt-0.5 shrink-0 ${
          pattern.severity === 'severe' ? 'text-red-600' :
          pattern.severity === 'moderate' ? 'text-amber-600' :
          'text-muted-foreground'
        }`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="font-medium text-sm">{patternLabel(pattern.pattern_type)}</div>
            <span className={`clinical-badge clinical-badge-${sevTone} capitalize text-[10px]`}>{pattern.severity}</span>
          </div>
          <div className="text-xs text-muted-foreground mt-1 leading-relaxed">{description}</div>
          <div className="text-[10px] font-mono text-muted-foreground mt-1.5">
            Detected {formatDateTime(pattern.detected_at)}
            {pattern.acknowledged_at && ` · Acknowledged ${formatDateTime(pattern.acknowledged_at)}`}
          </div>
          {!compact && !pattern.acknowledged_at && onAcknowledge && (
            <button
              onClick={onAcknowledge}
              disabled={acking}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium px-3 h-7 rounded-full border border-input bg-card hover:bg-muted transition-colors disabled:opacity-50"
            >
              <Check className="h-3 w-3" />
              {acking ? 'Acknowledging…' : 'Acknowledge'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function renderDescription(p: PatternRow): string {
  const d = p.details ?? {};
  switch (p.pattern_type) {
    case 'nocturnal_hypo':
      return `${d.episode_count ?? 0} episode${d.episode_count === 1 ? '' : 's'} 12am–6am${d.critical_episodes ? ` (${d.critical_episodes} critical)` : ''}`;
    case 'dawn_phenomenon':
      return `Affected ${d.affected_days ?? 0}/${d.total_days ?? 0} days, avg rise ${d.avg_rise_mg_dl ?? '?'} mg/dL`;
    case 'postprandial_spike':
      return `${d.total_spikes ?? 0} spikes (breakfast ${d.breakfast_spikes ?? 0}, lunch ${d.lunch_spikes ?? 0}, dinner ${d.dinner_spikes ?? 0})`;
    case 'hypo_unawareness':
      return `${d.unaware_episodes ?? 0} critical lows without warning reading`;
    case 'high_variability':
      return `CV ${d.cv_percent ?? '?'}% (target <36%)`;
    default:
      return '';
  }
}
