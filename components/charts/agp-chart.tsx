'use client';

import { useMemo } from 'react';
import { ComposedChart, Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceArea, ReferenceLine, CartesianGrid } from 'recharts';
import { binByHourOfDay } from '@/lib/cgm/analytics';

interface AgpChartProps {
  readings: { recorded_at: string; glucose_mg_dl: number }[];
  targetLow?: number;
  targetHigh?: number;
  urgentLow?: number;
  urgentHigh?: number;
  height?: number;
}

/**
 * Ambulatory Glucose Profile (AGP) — standard chart used in CGM reports.
 * Shows median glucose across 24h of day with 10/25/75/90 percentile bands.
 */
export function AgpChart({
  readings,
  targetLow = 70,
  targetHigh = 180,
  urgentLow = 54,
  urgentHigh = 250,
  height = 320,
}: AgpChartProps) {
  const data = useMemo(() => {
    const buckets = binByHourOfDay(readings);
    return buckets.map((b) => ({
      hour: b.hour,
      hourLabel: `${String(b.hour).padStart(2, '0')}:00`,
      p10: b.p10,
      p25: b.p25,
      p50: b.p50,
      p75: b.p75,
      p90: b.p90,
      // Stacked area data: lower band, mid band, upper band
      p10_to_25: b.p25 != null && b.p10 != null ? b.p25 - b.p10 : null,
      p25_to_75: b.p75 != null && b.p25 != null ? b.p75 - b.p25 : null,
      p75_to_90: b.p90 != null && b.p75 != null ? b.p90 - b.p75 : null,
      count: b.count,
    }));
  }, [readings]);

  const hasData = data.some((d) => d.p50 != null);

  if (!hasData) {
    return (
      <div
        className="flex items-center justify-center text-sm text-muted-foreground"
        style={{ height }}
      >
        No glucose readings in this period.
      </div>
    );
  }

  return (
    <div className="w-full px-2 pt-2 pb-4" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 30, bottom: 10, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} vertical={false} />

          {/* Reference zones */}
          <ReferenceArea y1={urgentLow} y2={targetLow} fill="hsl(var(--clinical-low))" fillOpacity={0.07} />
          <ReferenceArea y1={targetLow} y2={targetHigh} fill="hsl(var(--clinical-inrange))" fillOpacity={0.08} />
          <ReferenceArea y1={targetHigh} y2={urgentHigh} fill="hsl(var(--clinical-low))" fillOpacity={0.07} />
          <ReferenceLine y={targetLow} stroke="hsl(var(--clinical-inrange))" strokeDasharray="3 3" strokeOpacity={0.6} />
          <ReferenceLine y={targetHigh} stroke="hsl(var(--clinical-inrange))" strokeDasharray="3 3" strokeOpacity={0.6} />

          <XAxis
            dataKey="hourLabel"
            stroke="hsl(var(--muted-foreground))"
            fontSize={10}
            tickLine={false}
            axisLine={{ stroke: 'hsl(var(--border))' }}
            interval={2}
          />
          <YAxis
            domain={[40, 400]}
            stroke="hsl(var(--muted-foreground))"
            fontSize={10}
            tickLine={false}
            axisLine={{ stroke: 'hsl(var(--border))' }}
            tickFormatter={(v) => `${v}`}
            ticks={[54, 70, 100, 140, 180, 250, 300]}
          />
          <Tooltip
            contentStyle={{
              background: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '10px',
              fontSize: '11px',
              padding: '8px 12px',
            }}
            labelStyle={{ color: 'hsl(var(--muted-foreground))', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}
            formatter={(value: any, name: string) => {
              const labelMap: Record<string, string> = {
                p10: 'P10', p25: 'P25', p50: 'Median', p75: 'P75', p90: 'P90',
              };
              return [`${value} mg/dL`, labelMap[name] ?? name];
            }}
          />

          {/* Lower band: P10–P25 (faint) */}
          <Area
            type="monotone"
            dataKey="p10"
            stackId="1"
            stroke="none"
            fill="transparent"
            connectNulls
          />
          <Area
            type="monotone"
            dataKey="p10_to_25"
            stackId="1"
            stroke="none"
            fill="hsl(var(--accent))"
            fillOpacity={0.12}
            connectNulls
          />
          {/* Mid band: P25–P75 (darker) */}
          <Area
            type="monotone"
            dataKey="p25_to_75"
            stackId="1"
            stroke="none"
            fill="hsl(var(--accent))"
            fillOpacity={0.28}
            connectNulls
          />
          {/* Upper band: P75–P90 (faint) */}
          <Area
            type="monotone"
            dataKey="p75_to_90"
            stackId="1"
            stroke="none"
            fill="hsl(var(--accent))"
            fillOpacity={0.12}
            connectNulls
          />

          {/* Median line on top */}
          <Line
            type="monotone"
            dataKey="p50"
            stroke="hsl(var(--accent))"
            strokeWidth={2.5}
            dot={false}
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
