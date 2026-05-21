import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Download } from 'lucide-react';
import { visitVolumeWeekly, visitVolumeByProvider, type ReportRange } from '@/lib/reports/queries';

export const metadata = { title: 'Visit volume' };

export default async function VisitsReportPage({ searchParams }: { searchParams: { range?: ReportRange } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const range = (searchParams.range ?? '90d') as ReportRange;
  const [weekly, byProvider] = await Promise.all([
    visitVolumeWeekly(supabase as any, range),
    visitVolumeByProvider(supabase as any),
  ]);

  const totals = weekly.reduce(
    (acc, w) => ({
      completed: acc.completed + w.completed,
      no_show: acc.no_show + w.no_show,
      cancelled: acc.cancelled + w.cancelled,
      total: acc.total + w.total,
    }),
    { completed: 0, no_show: 0, cancelled: 0, total: 0 }
  );
  const noShowRate = totals.completed + totals.no_show > 0
    ? (100 * totals.no_show / (totals.completed + totals.no_show)).toFixed(1)
    : '—';

  const maxBarValue = Math.max(...weekly.map((w) => w.total), 1);

  return (
    <div className="space-y-6">
      <Link href="/app/reports" className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3 w-3" /> All reports
      </Link>

      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-3xl tracking-tight">Visit volume</h1>
          <p className="text-sm text-muted-foreground mt-1">{rangeLabel(range)} · grouped by week</p>
        </div>
        <div className="flex items-center gap-2">
          <RangeToggle current={range} />
          <a
            href={`/api/reports/visit_volume?range=${range}&format=csv`}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full border border-input bg-card text-sm font-medium hover:bg-muted transition-colors"
          >
            <Download className="h-3.5 w-3.5" /> CSV
          </a>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Total visits" value={totals.total} />
        <Stat label="Completed" value={totals.completed} tone="good" />
        <Stat label="No-show rate" value={`${noShowRate}%`} tone={Number(noShowRate) > 15 ? 'warn' : 'good'} />
        <Stat label="Cancelled" value={totals.cancelled} />
      </div>

      <section className="bg-card rounded-2xl border border-border p-5">
        <h2 className="font-display text-lg mb-4">Weekly breakdown</h2>
        {weekly.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No visits in this range.</p>
        ) : (
          <div className="space-y-2">
            {weekly.map((w) => (
              <div key={w.week_start} className="grid grid-cols-12 gap-3 items-center text-xs">
                <div className="col-span-2 font-mono text-muted-foreground tabular-nums">
                  {new Date(w.week_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>
                <div className="col-span-8 flex h-7 rounded overflow-hidden bg-muted/50">
                  <div className="bg-green-500" style={{ width: `${(w.completed / maxBarValue) * 100}%` }} title={`Completed ${w.completed}`} />
                  <div className="bg-red-400" style={{ width: `${(w.no_show / maxBarValue) * 100}%` }} title={`No-show ${w.no_show}`} />
                  <div className="bg-amber-400" style={{ width: `${(w.cancelled / maxBarValue) * 100}%` }} title={`Cancelled ${w.cancelled}`} />
                </div>
                <div className="col-span-2 text-right font-mono tabular-nums">
                  {w.total}
                </div>
              </div>
            ))}
            <div className="flex items-center gap-4 pt-3 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 bg-green-500 rounded-sm" /> Completed</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 bg-red-400 rounded-sm" /> No-show</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 bg-amber-400 rounded-sm" /> Cancelled</span>
            </div>
          </div>
        )}
      </section>

      {byProvider.length > 0 && (
        <section className="bg-card rounded-2xl border border-border overflow-hidden">
          <header className="px-5 py-4 border-b border-border">
            <h2 className="font-display text-lg">By provider (last 90d)</h2>
          </header>
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr className="text-left font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="px-5 py-2.5 font-medium">Provider</th>
                <th className="px-5 py-2.5 font-medium text-right">Completed</th>
                <th className="px-5 py-2.5 font-medium text-right">No-show</th>
                <th className="px-5 py-2.5 font-medium text-right">Cancelled</th>
                <th className="px-5 py-2.5 font-medium text-right">No-show %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {byProvider.map((p) => (
                <tr key={p.provider_id}>
                  <td className="px-5 py-2.5">{p.provider_name ?? '—'}</td>
                  <td className="px-5 py-2.5 text-right font-mono tabular-nums">{p.completed}</td>
                  <td className="px-5 py-2.5 text-right font-mono tabular-nums">{p.no_show}</td>
                  <td className="px-5 py-2.5 text-right font-mono tabular-nums">{p.cancelled}</td>
                  <td className={`px-5 py-2.5 text-right font-mono tabular-nums ${(p.no_show_rate_pct ?? 0) > 15 ? 'text-amber-700 dark:text-amber-300' : ''}`}>
                    {p.no_show_rate_pct ?? '—'}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string | number; tone?: 'good' | 'warn' }) {
  const t = tone === 'warn' ? 'border-amber-300 dark:border-amber-800' : '';
  return (
    <div className={`bg-card rounded-2xl border ${t || 'border-border'} p-4`}>
      <div className="font-display text-2xl tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

function RangeToggle({ current }: { current: ReportRange }) {
  const ranges: ReportRange[] = ['30d', '90d', 'ytd', '12m'];
  return (
    <div className="inline-flex bg-muted/50 rounded-full p-0.5">
      {ranges.map((r) => (
        <Link
          key={r}
          href={`?range=${r}`}
          className={`h-8 px-3 rounded-full text-xs font-mono uppercase tracking-wider flex items-center transition-colors ${
            current === r ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {r}
        </Link>
      ))}
    </div>
  );
}

function rangeLabel(r: ReportRange): string {
  return ({ '30d': 'Last 30 days', '90d': 'Last 90 days', '12m': 'Last 12 months', ytd: 'Year to date' } as const)[r];
}
