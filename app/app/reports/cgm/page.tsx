import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Download, Activity } from 'lucide-react';
import { cgmEngagement } from '@/lib/reports/queries';

export const metadata = { title: 'CGM engagement' };

export default async function CgmReportPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const data = await cgmEngagement(supabase as any);
  const total = data?.total_patients ?? 0;
  const withCgm = data?.patients_with_cgm ?? 0;
  const sync24 = data?.syncing_24h ?? 0;
  const sync7 = data?.syncing_7d ?? 0;
  const stale = data?.stale_connections ?? 0;

  const cgmPct = total > 0 ? Math.round(100 * withCgm / total) : 0;
  const syncRate = withCgm > 0 ? Math.round(100 * sync24 / withCgm) : 0;

  return (
    <div className="space-y-6">
      <Link href="/app/reports" className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3 w-3" /> All reports
      </Link>

      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-3xl tracking-tight">CGM engagement</h1>
          <p className="text-sm text-muted-foreground mt-1">Connection coverage and sync health</p>
        </div>
        <a
          href="/api/reports/cgm_engagement?format=csv"
          className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full border border-input bg-card text-sm font-medium hover:bg-muted transition-colors"
        >
          <Download className="h-3.5 w-3.5" /> CSV
        </a>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Active patients" value={total} />
        <Stat label="On CGM" value={`${withCgm} (${cgmPct}%)`} tone="good" />
        <Stat label="Syncing past 24h" value={`${sync24} (${syncRate}%)`} tone={syncRate > 70 ? 'good' : syncRate > 40 ? 'warn' : 'bad'} />
        <Stat label="Stale (>7d)" value={stale} tone={stale === 0 ? 'good' : 'warn'} />
      </div>

      <section className="bg-card rounded-2xl border border-border p-5 space-y-4">
        <h2 className="font-display text-lg">Funnel</h2>
        {total === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No active patients yet.</p>
        ) : (
          <div className="space-y-3">
            <FunnelStep label="Active patients" value={total} max={total} color="bg-muted-foreground" />
            <FunnelStep label="With CGM connection" value={withCgm} max={total} color="bg-primary" />
            <FunnelStep label="Syncing in last 7 days" value={sync7} max={total} color="bg-green-500" />
            <FunnelStep label="Syncing in last 24 hours" value={sync24} max={total} color="bg-green-700" />
          </div>
        )}
      </section>

      {stale > 0 && (
        <section className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-2xl p-5">
          <div className="flex items-start gap-3">
            <Activity className="h-4 w-4 text-amber-700 dark:text-amber-300 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium text-amber-900 dark:text-amber-100">{stale} stale CGM connection{stale === 1 ? '' : 's'}</h3>
              <p className="text-sm text-amber-800 dark:text-amber-200 mt-1">
                These patients haven&rsquo;t synced in over 7 days. Reasons typically include expired Dexcom OAuth tokens, sensor not worn, or app uninstalled.
              </p>
              <Link href="/app/cgm" className="inline-block mt-2 text-sm font-medium text-amber-900 dark:text-amber-100 underline">
                Open CGM admin →
              </Link>
            </div>
          </div>
        </section>
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

function FunnelStep({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="grid grid-cols-12 gap-3 items-center text-sm">
      <div className="col-span-4 text-xs text-muted-foreground">{label}</div>
      <div className="col-span-6 h-6 bg-muted/40 rounded relative overflow-hidden">
        <div className={`absolute inset-y-0 left-0 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="col-span-2 text-right font-mono tabular-nums text-xs">
        {value} · {pct.toFixed(0)}%
      </div>
    </div>
  );
}
