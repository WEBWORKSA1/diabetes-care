'use client';

import { LineChart, Line, ResponsiveContainer, YAxis, ReferenceLine, Tooltip } from 'recharts';
import { formatDate } from '@/lib/utils';

type A1cPoint = { collected_at: string; value: number };

export function A1cSparkline({
  data,
  height = 60,
  target = 7.0,
}: {
  data: A1cPoint[];
  height?: number;
  target?: number;
}) {
  if (!data || data.length === 0) return null;

  // Reverse for chronological order (oldest first)
  const chronological = [...data].reverse().map((d) => ({
    date: formatDate(d.collected_at),
    value: Number(d.value),
    rawDate: d.collected_at,
  }));

  const minVal = Math.min(...chronological.map((d) => d.value), target) - 0.5;
  const maxVal = Math.max(...chronological.map((d) => d.value), target) + 0.5;

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chronological} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
          <YAxis domain={[minVal, maxVal]} hide />
          <ReferenceLine y={target} stroke="hsl(var(--clinical-inrange))" strokeDasharray="2 2" strokeOpacity={0.6} />
          <Tooltip
            contentStyle={{
              background: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
              fontSize: '12px',
              padding: '6px 10px',
            }}
            labelStyle={{ color: 'hsl(var(--muted-foreground))', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}
            formatter={(v: number) => [`${v.toFixed(1)}%`, 'A1C']}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="hsl(var(--accent))"
            strokeWidth={2}
            dot={{ fill: 'hsl(var(--accent))', r: 3 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
