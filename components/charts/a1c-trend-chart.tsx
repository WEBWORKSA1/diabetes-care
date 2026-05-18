'use client';

import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, ReferenceArea, ReferenceLine, Tooltip, CartesianGrid } from 'recharts';
import { formatDate } from '@/lib/utils';

type A1cPoint = { collected_at: string; value: number };

export function A1cTrendChart({
  data,
  target = 7.0,
  height = 320,
}: {
  data: A1cPoint[];
  target?: number;
  height?: number;
}) {
  if (!data || data.length === 0) {
    return (
      <div className="px-6 py-16 text-center text-sm text-muted-foreground">
        No A1C values recorded.
      </div>
    );
  }

  const chronological = [...data].reverse().map((d) => ({
    date: formatDate(d.collected_at),
    value: Number(d.value),
    rawDate: d.collected_at,
  }));

  const values = chronological.map((d) => d.value);
  const minVal = Math.max(0, Math.min(...values, 5.0) - 1);
  const maxVal = Math.max(...values, 10.0) + 1;

  return (
    <div className="w-full px-6 pt-2 pb-6" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chronological} margin={{ top: 10, right: 30, bottom: 10, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} vertical={false} />

          {/* Background bands for clinical ranges */}
          <ReferenceArea y1={0} y2={5.7} fill="hsl(var(--clinical-inrange))" fillOpacity={0.05} />
          <ReferenceArea y1={5.7} y2={7.0} fill="hsl(var(--clinical-inrange))" fillOpacity={0.08} />
          <ReferenceArea y1={7.0} y2={9.0} fill="hsl(var(--clinical-low))" fillOpacity={0.06} />
          <ReferenceArea y1={9.0} y2={20} fill="hsl(var(--clinical-high))" fillOpacity={0.06} />

          {/* Target line */}
          <ReferenceLine
            y={target}
            stroke="hsl(var(--clinical-inrange))"
            strokeDasharray="4 4"
            label={{
              value: `Target ${target}%`,
              position: 'right',
              fontSize: 10,
              fill: 'hsl(var(--muted-foreground))',
            }}
          />

          <XAxis
            dataKey="date"
            stroke="hsl(var(--muted-foreground))"
            fontSize={11}
            tickLine={false}
            axisLine={{ stroke: 'hsl(var(--border))' }}
          />
          <YAxis
            domain={[minVal, maxVal]}
            stroke="hsl(var(--muted-foreground))"
            fontSize={11}
            tickLine={false}
            axisLine={{ stroke: 'hsl(var(--border))' }}
            tickFormatter={(v) => `${v}%`}
            width={50}
          />
          <Tooltip
            contentStyle={{
              background: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '12px',
              fontSize: '12px',
              padding: '10px 14px',
            }}
            labelStyle={{ color: 'hsl(var(--muted-foreground))', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}
            formatter={(v: number) => [`${v.toFixed(1)}%`, 'A1C']}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="hsl(var(--accent))"
            strokeWidth={2.5}
            dot={{ fill: 'hsl(var(--accent))', r: 4, strokeWidth: 2, stroke: 'hsl(var(--background))' }}
            activeDot={{ r: 6, strokeWidth: 2, stroke: 'hsl(var(--background))' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
