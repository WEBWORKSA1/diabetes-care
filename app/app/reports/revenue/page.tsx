import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Download, AlertCircle } from 'lucide-react';
import { revenueMonthly } from '@/lib/reports/queries';

export const metadata = { title: 'Revenue (estimate)' };

export default async function RevenueReportPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const monthly = await revenueMonthly(supabase as any);
  const last12mTotal = monthly.reduce((s, m) => s + Number(m.estimated_revenue_usd), 0);
  const last12mVisits = monthly.reduce((s, m) => s + m.completed_visits, 0);
  const avgPerVisit = last12mVisits > 0 ? last12mTotal / last12mVisits : 0;

  const maxRevenue = Math.max(...monthly.map((m) => Number(m.estimated_revenue_usd)), 1);

  return (
    <div className="space-y-6">
      <Link href="/app/reports" className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3 w-3" /> All reports
      </Link>

      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-3xl tracking-tight">Revenue estimate</h1>
          <p className="text-sm text-muted-foreground mt-1">CPT-proxy estimate from completed visits</p>
        </div>
        <a href="/api/reports/revenue?format=csv" className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full border border-input bg-card text-sm font-medium hover:bg-muted transition-colors">
          <Download className="h-3.5 w-3.5" /> CSV
        </a>
      </header>

      <section className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-2xl p-4 flex items-start gap-3">
        <AlertCircle className="h-4 w-4 text-amber-700 dark:text-amber-300 shrink-0 mt-0.5" />
        <div className="text-sm text-amber-900 dark:text-amber-100">
          <strong>Estimate only.</strong> This is not your actual collections. Numbers use rough national-average CPT reimbursement (e.g. 99213 = $108, 99204 = $180) before payer mix, modifiers, denials, or write-offs. For real revenue, connect a billing system later.
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Last 12 months" value={`$${last12mTotal.toLocaleString('en-US', { maximumFractionDigits: 0 })}`} />
        <Stat label="Completed visits" value={last12mVisits} />
        <Stat label="Avg per visit" value={`$${avgPerVisit.toFixed(0)}`} />
      </div>

      <section className="bg-card rounded-2xl border border-border p-5">
        <h2 className="font-display text-lg mb-4">Monthly trend</h2>
        {monthly.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No completed visits in the last 12 months.</p>
        ) : (
          <div className="space-y-2">
            {monthly.map((m) => {
              const rev = Number(m.estimated_revenue_usd);
              const pct = (rev / maxRevenue) * 100;
              return (
                <div key={m.month_start} className="grid grid-cols-12 gap-3 items-center text-xs">
                  <div className="col-span-2 font-mono text-muted-foreground tabular-nums">
                    {new Date(m.month_start).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}
                  </div>
                  <div className="col-span-7 h-7 bg-muted/40 rounded relative overflow-hidden">
                    <div className="absolute inset-y-0 left-0 bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="col-span-3 text-right font-mono tabular-nums">
                    <div>${rev.toLocaleString('en-US', { maximumFractionDigits: 0 })}</div>
                    <div className="text-[10px] text-muted-foreground">{m.completed_visits} visits</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-card rounded-2xl border border-border p-4">
      <div className="font-display text-2xl tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
    </div>
  );
}
