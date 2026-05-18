'use client';

import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, ReferenceArea, Tooltip, CartesianGrid } from 'recharts';
import { formatDate } from '@/lib/utils';

type LabPoint = {
  collected_at: string;
  value: number;
  is_abnormal?: boolean | null;
  reference_low?: number | null;
  reference_high?: number | null;
};

export function LabTrendChart({
  data,
  label,
  unit,
  refLow,
  refHigh,
  height = 200,
}: {
  data: LabPoint[];
  label: string;
  unit: string;
  refLow?: number | null;
  refHigh?: number | null;
  height?: number;
}) {
  if (!data || data.length === 0) {
    return <div className="py-8 text-center text-xs text-muted-foreground">No data</div>;
  }

  if (data.length === 1) {
    const single = data[0];
    const abnormal = single.is_abnormal;
    return (
      <div className="py-6 px-4 text-center">
        <div className={`font-display text-3xl tabular-nums ${abnormal ? 'text-red-700 dark:text-red-300' : ''}`}>
          {Number(single.value).toFixed(1)}
          <span className="text-sm text-muted-foreground ml-1">{unit}</span>
        </div>
        <div className="text-xs text-muted-foreground mt-1">{formatDate(single.collected_at)}</div>
        {refLow != null && refHigh != null && (
          <div className="text-[10px] font-mono text-muted-foreground mt-1">
            Ref: {refLow}–{refHigh} {unit}
          </div>
        )}
      </div>
    );
  }

  const chronological = [...data].reverse().map((d) => ({
    date: formatDate(d.collected_at),
    value: Number(d.value),
    rawDate: d.collected_at,
  }));

  const values = chronological.map((d) => d.value);
  const minVal = Math.min(...values, refLow ?? Infinity);
  const maxVal = Math.max(...values, refHigh ?? -Infinity);
  const padding = (maxVal - minVal) * 0.15 || 1;

  return (
    <div className="w-full px-2 py-2" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chronological} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.3} vertical={false} />

          {refLow != null && refHigh != null && (
            <ReferenceArea y1={refLow} y2={refHigh} fill="hsl(var(--clinical-inrange))" fillOpacity={0.08} />
          )}

          <XAxis
            dataKey="date"
            stroke="hsl(var(--muted-foreground))"
            fontSize={10}
            tickLine={false}
            axisLine={{ stroke: 'hsl(var(--border))' }}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[minVal - padding, maxVal + padding]}
            stroke="hsl(var(--muted-foreground))"
            fontSize={10}
            tickLine={false}
            axisLine={{ stroke: 'hsl(var(--border))' }}
            width={45}
          />
          <Tooltip
            contentStyle={{
              background: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '10px',
              fontSize: '12px',
              padding: '8px 12px',
            }}
            labelStyle={{ color: 'hsl(var(--muted-foreground))', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}
            formatter={(v: number) => [`${v.toFixed(2)} ${unit}`, label]}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="hsl(var(--accent))"
            strokeWidth={2}
            dot={{ fill: 'hsl(var(--accent))', r: 3, strokeWidth: 1.5, stroke: 'hsl(var(--background))' }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
