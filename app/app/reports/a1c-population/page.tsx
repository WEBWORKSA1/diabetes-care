import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Download } from 'lucide-react';
import { a1cPopulation, a1cTrendMonthly } from '@/lib/reports/queries';

export const metadata = { title: 'A1C population health' };

export default async function A1cPopulationReportPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [pop, trend] = await Promise.all([
    a1cPopulation(supabase as any),
    a1cTrendMonthly(supabase as any, 12),
  ]);

  const total = pop?.patients_with_a1c ?? 0;
  const bands = pop ? [
    { key: 'normal', label: 'Normal (<5.7%)', value: pop.band_normal, color: 'bg-blue-500' },
    { key: 'at_goal', label: 'At goal (5.7–6.9%)', value: pop.band_at_goal, color: 'bg-green-500' },
    { key: 'borderline', label: 'Borderline (7.0–7.9%)', value: pop.band_borderline, color: 'bg-yellow-500' },
    { key: 'high', label: 'High (8.0–8.9%)', value: pop.band_high, color: 'bg-orange-500' },
    { key: 'very_high', label: 'Very high (≥9.0%)', value: pop.band_very_high, color: 'bg-red-500' },
  ] : [];

  const atGoalPct = pop ? Math.round(100 * (pop.band_normal + pop.band_at_goal) / Math.max(1, total)) : 0;
  const veryHighPct = pop ? Math.round(100 * pop.band_very_high / Math.max(1, total)) : 0;

  const trendMin = Math.min(...trend.map((t) => t.mean_a1c), 6);
  const trendMax = Math.max(...trend.map((t) => t.mean_a1c), 9);
  const trendRange = trendMax - trendMin || 1;

  return (
    <div className="space-y-6">
      <Link href="/app/reports" className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3 w-3" /> All reports
      </Link>

      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-3xl tracking-tight">A1C population health</h1>
          <p className="text-sm text-muted-foreground mt-1">Latest A1C per patient · ADA bands</p>
        </div>
        <a
          href="/api/reports/a1c_population?format=csv"
          className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full border border-input bg-card text-sm font-medium hover:bg-muted transition-colors"
        >
          <Download className="h-3.5 w-3.5" /> CSV
        </a>
      </header>

      {!pop || total === 0 ? (
        <div className="bg-card rounded-2xl border border-border px-6 py-16 text-center">
          <p className="font-display text-lg">No A1C data yet</p>
          <p className="text-sm text-muted-foreground mt-1">Once patients have A1C labs, this report fills in.</p>
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-4">
            <Stat label="Patients with A1C" value={total} />
            <Stat label="At goal (<7.0%)" value={`${atGoalPct}%`} tone={atGoalPct >= 60 ? 'good' : atGoalPct >= 40 ? 'warn' : 'bad'} />
            <Stat label="Very high (≥9.0%)" value={`${veryHighPct}%`} tone={veryHighPct < 10 ? 'good' : veryHighPct < 20 ? 'warn' : 'bad'} />
            <Stat label="Mean A1C" value={pop.mean_a1c ? `${pop.mean_a1c}%` : '—'} />
          </div>

          <section className="bg-card rounded-2xl border border-border p-5">
            <h2 className="font-display text-lg mb-4">Distribution</h2>
            <div className="space-y-3">
              {bands.map((b) => {
                const pct = (b.value / total) * 100;
                return (
                  <div key={b.key} className="grid grid-cols-12 gap-3 items-center text-sm">
                    <div className="col-span-4 text-xs text-muted-foreground">{b.label}</div>
                    <div className="col-span-6 h-6 bg-muted/40 rounded relative overflow-hidden">
                      <div className={`absolute inset-y-0 left-0 ${b.color}`} style={{ width: `${pct}%` }} />
                    </div>
                    <div className="col-span-2 text-right font-mono tabular-nums text-xs">
                      {b.value} · {pct.toFixed(0)}%
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {trend.length >= 2 && (
            <section className="bg-card rounded-2xl border border-border p-5">
              <h2 className="font-display text-lg mb-4">Practice mean A1C trend</h2>
              <div className="relative h-48">
                <svg viewBox="0 0 600 200" className="w-full h-full">
                  <line x1="0" y1="100" x2="600" y2="100" stroke="hsl(var(--border))" strokeDasharray="3 3" />
                  <text x="5" y="95" className="text-[8px] fill-muted-foreground font-mono">7.0% goal</text>
                  <polyline
                    fill="none"
                    stroke="hsl(var(--primary))"
                    strokeWidth="2"
                    points={trend.map((t, i) => {
                      const x = (i / (trend.length - 1)) * 580 + 10;
                      const y = 200 - ((t.mean_a1c - trendMin) / trendRange) * 180 - 10;
                      return `${x},${y}`;
                    }).join(' ')}
                  />
                  {trend.map((t, i) => {
                    const x = (i / (trend.length - 1)) * 580 + 10;
                    const y = 200 - ((t.mean_a1c - trendMin) / trendRange) * 180 - 10;
                    return (
                      <g key={t.month_start}>
                        <circle cx={x} cy={y} r="3" fill="hsl(var(--primary))" />
                        <text x={x} y={y - 8} textAnchor="middle" className="text-[9px] fill-foreground font-mono tabular-nums">{t.mean_a1c}</text>
                      </g>
                    );
                  })}
                </svg>
              </div>
              <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-muted-foreground mt-2">
                <span>{new Date(trend[0].month_start).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
                <span>{new Date(trend[trend.length - 1].month_start).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string | number; tone?: 'good' | 'warn' | 'bad' }) {
  const t = tone === 'good' ? 'border-green-300 dark:border-green-800' : tone === 'warn' ? 'border-amber-300 dark:border-amber-800' : tone === 'bad' ? 'border-red-300 dark:border-red-800' : '';
  return (
    <div className={`bg-card rounded-2xl border ${t || 'border-border'} p-4`}>
      <div className="font-display text-2xl tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
    </div>
  );
}
