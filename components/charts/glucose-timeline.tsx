'use client';

import { useMemo } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, ReferenceArea, ReferenceLine, Tooltip, CartesianGrid } from 'recharts';
import type { GlucoseReading, GlucoseThresholds } from '@/lib/clinical/glucose-stats';
import { DEFAULT_THRESHOLDS } from '@/lib/clinical/glucose-stats';

/**
 * Continuous glucose timeline — every reading plotted over time.
 * Useful for daily/weekly review.
 */
export function GlucoseTimelineChart({
  readings,
  thresholds = DEFAULT_THRESHOLDS,
  height = 260,
}: {
  readings: GlucoseReading[];
  thresholds?: GlucoseThresholds;
  height?: number;
}) {
  const data = useMemo(() => {
    return [...readings]
      .sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime())
      .map((r) => ({
        time: new Date(r.recorded_at).getTime(),
        value: Number(r.glucose_mg_dl),
      }));
  }, [readings]);

  if (data.length === 0) {
    return (
      <div className="px-6 py-16 text-center text-sm text-muted-foreground">No readings to display.</div>
    );
  }

  return (
    <div className="w-full px-2 pt-4 pb-6" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 30, bottom: 10, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.3} vertical={false} />

          <ReferenceArea
            y1={thresholds.target_low}
            y2={thresholds.target_high}
            fill="hsl(var(--clinical-inrange))"
            fillOpacity={0.08}
          />
          <ReferenceLine y={thresholds.target_high} stroke="hsl(var(--clinical-high))" strokeDasharray="3 3" strokeOpacity={0.4} />
          <ReferenceLine y={thresholds.target_low} stroke="hsl(var(--clinical-low))" strokeDasharray="3 3" strokeOpacity={0.4} />

          <XAxis
            dataKey="time"
            type="number"
            domain={['dataMin', 'dataMax']}
            scale="time"
            stroke="hsl(var(--muted-foreground))"
            fontSize={10}
            tickLine={false}
            axisLine={{ stroke: 'hsl(var(--border))' }}
            tickFormatter={(t) => new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          />
          <YAxis
            stroke="hsl(var(--muted-foreground))"
            fontSize={10}
            tickLine={false}
            axisLine={{ stroke: 'hsl(var(--border))' }}
            domain={[40, 'dataMax + 20']}
            width={45}
          />
          <Tooltip
            contentStyle={{
              background: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '10px',
              fontSize: '11px',
              padding: '8px 12px',
            }}
            labelFormatter={(t) => new Date(t).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' })}
            formatter={(v: number) => [`${v} mg/dL`, 'Glucose']}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="hsl(var(--accent))"
            strokeWidth={1.5}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
