'use client';

import type { CgmStats } from '@/lib/cgm/analytics';

/**
 * TIR (Time in Range) bar with 5 segments:
 * urgent low | low | in range | high | urgent high
 */
export function TirBar({ stats, compact = false }: { stats: CgmStats; compact?: boolean }) {
  const { tir } = stats;
  const segments = [
    { key: 'urgentLow', value: tir.urgentLow, color: 'bg-red-600', label: '<54' },
    { key: 'low', value: tir.low, color: 'bg-amber-500', label: '54–70' },
    { key: 'range', value: tir.range, color: 'bg-green-600', label: '70–180' },
    { key: 'high', value: tir.high, color: 'bg-amber-500', label: '180–250' },
    { key: 'urgentHigh', value: tir.urgentHigh, color: 'bg-red-600', label: '>250' },
  ];

  return (
    <div className="space-y-2">
      <div className={`flex w-full rounded-md overflow-hidden ${compact ? 'h-3' : 'h-5'}`}>
        {segments.map((s) => (
          <div
            key={s.key}
            className={s.color}
            style={{ width: `${s.value}%`, transition: 'width 300ms ease-out' }}
            title={`${s.label}: ${s.value.toFixed(1)}%`}
          />
        ))}
      </div>
      {!compact && (
        <div className="grid grid-cols-5 gap-1 text-[10px] font-mono">
          {segments.map((s, i) => (
            <div key={s.key} className={`text-center ${i === 2 ? 'text-green-700 dark:text-green-300 font-medium' : 'text-muted-foreground'}`}>
              <div className="tabular-nums">{s.value.toFixed(1)}%</div>
              <div className="text-[9px] opacity-70">{s.label}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
