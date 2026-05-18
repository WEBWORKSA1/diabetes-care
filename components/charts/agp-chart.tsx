'use client';

import { useMemo } from 'react';
import { ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, ReferenceLine, ReferenceArea, Tooltip, CartesianGrid } from 'recharts';
import { computeAGP, type GlucoseReading, type GlucoseThresholds, DEFAULT_THRESHOLDS } from '@/lib/clinical/glucose-stats';

/**
 * Ambulatory Glucose Profile (AGP) chart.
 *
 * Shows median + 10/25/75/90 percentile bands by hour-of-day,
 * with target range shaded.
 */
export function AGPChart({
  readings,
  thresholds = DEFAULT_THRESHOLDS,
  height = 280,
}: {
  readings: GlucoseReading[];
  thresholds?: GlucoseThresholds;
  height?: number;
}) {
  const buckets = useMemo(() => computeAGP(readings), [readings]);

  // Flatten to chart-friendly format
  const data = buckets.map((b) => ({
    hour: b.hour,
    hourLabel: `${b.hour.toString().padStart(2, '0')}:00`,
    p10: b.p10,
    p25: b.p25,
    median: b.median,
    p75: b.p75,
    p90: b.p90,
    range_25_75: [b.p25, b.p75] as [number, number],
    range_10_90: [b.p10, b.p90] as [number, number],
  }));

  const hasData = data.some((d) => d.median > 0);

  if (!hasData) {
    return (
      <div className="px-6 py-16 text-center text-sm text-muted-foreground">
        Not enough data for AGP report. Need at least 24 hours of CGM readings.
      </div>
    );
  }

  return (
    <div className="w-full px-2 pt-4 pb-6" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 30, bottom: 10, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.3} vertical={false} />

          {/* Target range shaded */}
          <ReferenceArea
            y1={thresholds.target_low}
            y2={thresholds.target_high}
            fill="hsl(var(--clinical-inrange))"
            fillOpacity={0.1}
          />
          <ReferenceLine y={thresholds.target_low} stroke="hsl(var(--clinical-inrange))" strokeDasharray="4 4" strokeOpacity={0.5} />
          <ReferenceLine y={thresholds.target_high} stroke="hsl(var(--clinical-inrange))" strokeDasharray="4 4" strokeOpacity={0.5} />

          {/* 10-90% band (outer, lighter) */}
          <Area
            type="monotone"
            dataKey="range_10_90"
            stroke="none"
            fill="hsl(var(--accent))"
            fillOpacity={0.15}
          />
          {/* 25-75% band (inner, darker) */}
          <Area
            type="monotone"
            dataKey="range_25_75"
            stroke="none"
            fill="hsl(var(--accent))"
            fillOpacity={0.3}
          />
          {/* Median line */}
          <Line
            type="monotone"
            dataKey="median"
            stroke="hsl(var(--accent))"
            strokeWidth={2.5}
            dot={false}
          />

          <XAxis
            dataKey="hour"
            stroke="hsl(var(--muted-foreground))"
            fontSize={10}
            tickLine={false}
            axisLine={{ stroke: 'hsl(var(--border))' }}
            ticks={[0, 6, 12, 18, 23]}
            tickFormatter={(h) => `${h.toString().padStart(2, '0')}:00`}
          />
          <YAxis
            stroke="hsl(var(--muted-foreground))"
            fontSize={10}
            tickLine={false}
            axisLine={{ stroke: 'hsl(var(--border))' }}
            domain={[40, 'dataMax + 20']}
            tickFormatter={(v) => `${v}`}
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
            labelFormatter={(h) => `Hour ${h.toString().padStart(2, '0')}:00`}
            formatter={(value: any, name: any) => {
              if (Array.isArray(value)) return [`${value[0]}–${value[1]} mg/dL`, name === 'range_25_75' ? '25–75%' : '10–90%'];
              return [`${value} mg/dL`, name === 'median' ? 'Median' : name];
            }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
