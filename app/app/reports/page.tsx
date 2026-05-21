import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { BarChart3, Activity, AlertCircle, FlaskConical, Users, DollarSign, ChevronRight } from 'lucide-react';
import {
  visitVolumeWeekly, a1cPopulation, cgmEngagement,
  labGapA1c, labGapKidney, revenueMonthly,
} from '@/lib/reports/queries';

export const metadata = { title: 'Reports' };

export default async function ReportsHubPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Pull top-line numbers for each card preview
  const [visits90d, a1cPop, cgm, gapsA1c, gapsKidney, revenue] = await Promise.all([
    visitVolumeWeekly(supabase as any, '90d'),
    a1cPopulation(supabase as any),
    cgmEngagement(supabase as any),
    labGapA1c(supabase as any),
    labGapKidney(supabase as any),
    revenueMonthly(supabase as any),
  ]);

  const completedTotal = visits90d.reduce((s, w) => s + w.completed, 0);
  const noShowTotal = visits90d.reduce((s, w) => s + w.no_show, 0);
  const noShowRate = completedTotal + noShowTotal > 0
    ? (100 * noShowTotal / (completedTotal + noShowTotal)).toFixed(1)
    : '—';

  const a1cAtGoal = a1cPop
    ? Math.round(100 * (a1cPop.band_normal + a1cPop.band_at_goal) / Math.max(1, a1cPop.patients_with_a1c))
    : null;

  const cgmPct = cgm
    ? Math.round(100 * cgm.patients_with_cgm / Math.max(1, cgm.total_patients))
    : null;

  const overdueA1cCount = gapsA1c.length;
  const overdueKidneyCount = gapsKidney.length;

  const last12mRevenue = revenue.reduce((s, m) => s + Number(m.estimated_revenue_usd), 0);

  const reports = [
    {
      href: '/app/reports/visits',
      icon: BarChart3,
      title: 'Visit volume',
      stat: `${completedTotal} completed (90d)`,
      sub: `${noShowRate}% no-show rate`,
      tone: Number(noShowRate) > 15 ? 'warn' : 'normal',
    },
    {
      href: '/app/reports/a1c-population',
      icon: Activity,
      title: 'A1C population',
      stat: a1cAtGoal !== null ? `${a1cAtGoal}% at goal (<7.0%)` : 'No A1C data',
      sub: a1cPop ? `${a1cPop.patients_with_a1c} patients with A1C · mean ${a1cPop.mean_a1c ?? '—'}%` : '',
      tone: a1cAtGoal !== null && a1cAtGoal < 50 ? 'warn' : 'normal',
    },
    {
      href: '/app/reports/cgm',
      icon: FlaskConical,
      title: 'CGM engagement',
      stat: cgmPct !== null ? `${cgmPct}% on CGM` : 'No CGM data',
      sub: cgm ? `${cgm.syncing_24h} synced today · ${cgm.stale_connections} stale` : '',
      tone: 'normal',
    },
    {
      href: '/app/reports/lab-gaps',
      icon: AlertCircle,
      title: 'Lab gaps',
      stat: `${overdueA1cCount + overdueKidneyCount} patients overdue`,
      sub: `${overdueA1cCount} A1C · ${overdueKidneyCount} kidney`,
      tone: overdueA1cCount + overdueKidneyCount > 0 ? 'warn' : 'normal',
    },
    {
      href: '/app/reports/revenue',
      icon: DollarSign,
      title: 'Revenue (estimate)',
      stat: last12mRevenue > 0 ? `$${(last12mRevenue / 1000).toFixed(1)}K (12m)` : '$0',
      sub: 'CPT proxy · pre payer mix',
      tone: 'normal',
    },
  ];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl tracking-tight">Reports</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Practice-wide views. Every report exports to CSV.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        {reports.map((r) => (
          <Link
            key={r.href}
            href={r.href}
            className={`bg-card rounded-2xl border p-5 hover:border-foreground/30 transition-colors group ${
              r.tone === 'warn' ? 'border-amber-300 dark:border-amber-800' : 'border-border'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className={`p-2 rounded-lg ${r.tone === 'warn' ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300' : 'bg-muted text-muted-foreground'}`}>
                <r.icon className="h-4 w-4" />
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
            </div>
            <div className="font-display text-2xl tabular-nums">{r.stat}</div>
            <div className="text-xs text-muted-foreground mt-1">{r.title}</div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/60 mt-1">{r.sub}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
