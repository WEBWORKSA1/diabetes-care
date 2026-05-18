'use client';

import { useMemo } from 'react';
import type { GlucoseReading, GlucoseStats, GlucoseThresholds } from '@/lib/clinical/glucose-stats';
import { computeGlucoseStats, classifyTIR, DEFAULT_THRESHOLDS } from '@/lib/clinical/glucose-stats';

export function TIRStatsCard({
  readings,
  thresholds = DEFAULT_THRESHOLDS,
  periodLabel = '14 days',
}: {
  readings: GlucoseReading[];
  thresholds?: GlucoseThresholds;
  periodLabel?: string;
}) {
  const stats: GlucoseStats = useMemo(() => computeGlucoseStats(readings, thresholds), [readings, thresholds]);
  const cls = classifyTIR(stats.tir, stats.tbr_2);

  if (stats.count === 0) {
    return (
      <div className="px-6 py-10 text-center text-sm text-muted-foreground">No glucose data in this period.</div>
    );
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Period</div>
          <div className="text-sm font-medium">{periodLabel}</div>
        </div>
        <div className="text-right">
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Sensor capture</div>
          <div className={`text-sm font-medium tabular-nums ${stats.capturePercent < 70 ? 'text-amber-700 dark:text-amber-300' : ''}`}>
            {stats.capturePercent}%
          </div>
        </div>
      </div>

      {/* TIR stacked bar */}
      <div>
        <div className="flex items-baseline justify-between mb-2">
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Time in Range</div>
          <span className={`clinical-badge clinical-badge-${cls.tone}`}>{cls.label}</span>
        </div>
        <div className="h-3 rounded-full flex overflow-hidden bg-muted">
          {stats.tbr_2 > 0 && <div style={{ width: `${stats.tbr_2}%`, background: 'hsl(348 80% 45%)' }} />}
          {stats.tbr_1 > 0 && <div style={{ width: `${stats.tbr_1}%`, background: 'hsl(38 80% 60%)' }} />}
          {stats.tir > 0 && <div style={{ width: `${stats.tir}%`, background: 'hsl(145 50% 40%)' }} />}
          {stats.tar_1 > 0 && <div style={{ width: `${stats.tar_1}%`, background: 'hsl(0 64% 53%)', opacity: 0.7 }} />}
          {stats.tar_2 > 0 && <div style={{ width: `${stats.tar_2}%`, background: 'hsl(0 64% 53%)' }} />}
        </div>
        <div className="grid grid-cols-5 gap-1 mt-2 text-[10px] font-mono tabular-nums">
          <Cell label={`<${thresholds.critical_low_threshold}`} pct={stats.tbr_2} color="text-red-700 dark:text-red-300" />
          <Cell label={`${thresholds.critical_low_threshold}–${thresholds.target_low - 1}`} pct={stats.tbr_1} color="text-amber-700 dark:text-amber-300" />
          <Cell label={`${thresholds.target_low}–${thresholds.target_high}`} pct={stats.tir} color="text-green-700 dark:text-green-300" emphasized />
          <Cell label={`${thresholds.target_high + 1}–${thresholds.critical_high_threshold}`} pct={stats.tar_1} color="text-red-700 dark:text-red-300" />
          <Cell label={`>${thresholds.critical_high_threshold}`} pct={stats.tar_2} color="text-red-700 dark:text-red-300" />
        </div>
      </div>

      {/* Summary stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-border">
        <Stat label="Avg glucose" value={stats.mean} suffix="mg/dL" />
        <Stat label="GMI (est. A1C)" value={stats.gmi.toFixed(2)} suffix="%" tone={stats.gmi >= 7.0 ? 'high' : 'good'} />
        <Stat label="CV" value={stats.cv.toFixed(1)} suffix="%" tone={stats.cv > 36 ? 'high' : 'good'} />
        <Stat label="Readings" value={stats.count} />
      </div>
    </div>
  );
}

function Cell({ label, pct, color, emphasized }: { label: string; pct: number; color: string; emphasized?: boolean }) {
  return (
    <div className="text-center">
      <div className={`${color} ${emphasized ? 'font-semibold' : ''}`}>{pct.toFixed(1)}%</div>
      <div className="text-muted-foreground">{label}</div>
    </div>
  );
}

function Stat({ label, value, suffix, tone }: { label: string; value: number | string; suffix?: string; tone?: 'good' | 'high' }) {
  return (
    <div>
      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`font-display text-xl tabular-nums ${tone === 'high' ? 'text-red-700 dark:text-red-300' : tone === 'good' ? 'text-green-700 dark:text-green-300' : ''}`}>
        {value}
        {suffix && <span className="text-xs text-muted-foreground ml-1">{suffix}</span>}
      </div>
    </div>
  );
}
