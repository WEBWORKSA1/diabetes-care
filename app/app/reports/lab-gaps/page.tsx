import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Download, AlertCircle } from 'lucide-react';
import { labGapA1c, labGapKidney } from '@/lib/reports/queries';
import { formatDate } from '@/lib/utils';

export const metadata = { title: 'Lab gaps' };

export default async function LabGapsReportPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [a1cGaps, kidneyGaps] = await Promise.all([
    labGapA1c(supabase as any),
    labGapKidney(supabase as any),
  ]);

  const neverA1c = a1cGaps.filter((p) => p.gap_status === 'never').length;
  const highRiskOverdue = a1cGaps.filter((p) => p.gap_status === 'overdue_high_risk').length;
  const overdue = a1cGaps.filter((p) => p.gap_status === 'overdue').length;

  return (
    <div className="space-y-6">
      <Link href="/app/reports" className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3 w-3" /> All reports
      </Link>

      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-3xl tracking-tight">Lab gaps</h1>
          <p className="text-sm text-muted-foreground mt-1">Patients overdue for routine diabetes monitoring</p>
        </div>
        <div className="flex items-center gap-2">
          <a href="/api/reports/lab_gap_a1c?format=csv" className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full border border-input bg-card text-sm font-medium hover:bg-muted transition-colors">
            <Download className="h-3.5 w-3.5" /> A1C gaps CSV
          </a>
          <a href="/api/reports/lab_gap_kidney?format=csv" className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full border border-input bg-card text-sm font-medium hover:bg-muted transition-colors">
            <Download className="h-3.5 w-3.5" /> Kidney gaps CSV
          </a>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Never had A1C" value={neverA1c} tone={neverA1c > 0 ? 'warn' : 'good'} />
        <Stat label="High-risk overdue" value={highRiskOverdue} tone={highRiskOverdue > 0 ? 'bad' : 'good'} sub=">3 months" />
        <Stat label="Standard overdue" value={overdue} tone={overdue > 0 ? 'warn' : 'good'} sub=">6 months" />
        <Stat label="Kidney monitoring gaps" value={kidneyGaps.length} tone={kidneyGaps.length > 0 ? 'warn' : 'good'} sub="eGFR or ACR" />
      </div>

      <section className="bg-card rounded-2xl border border-border overflow-hidden">
        <header className="px-5 py-4 border-b border-border">
          <h2 className="font-display text-lg">A1C overdue ({a1cGaps.length})</h2>
          <p className="text-xs text-muted-foreground mt-0.5">ADA: every 3 months for A1C ≥7%, every 6 months when at goal</p>
        </header>
        {a1cGaps.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">All diabetes patients are up to date on A1C.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr className="text-left font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="px-5 py-2.5 font-medium">Patient</th>
                <th className="px-5 py-2.5 font-medium">Type</th>
                <th className="px-5 py-2.5 font-medium text-right">Last A1C</th>
                <th className="px-5 py-2.5 font-medium">Date</th>
                <th className="px-5 py-2.5 font-medium text-right">Days</th>
                <th className="px-5 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {a1cGaps.slice(0, 100).map((g) => (
                <tr key={g.patient_id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-5 py-2.5">
                    <Link href={`/app/patients/${g.patient_id}`} className="font-medium hover:text-accent">
                      {g.last_name}, {g.first_name}
                    </Link>
                    <span className="text-[10px] font-mono text-muted-foreground ml-2">{g.mrn}</span>
                  </td>
                  <td className="px-5 py-2.5 text-xs capitalize">{g.diabetes_type?.replace('_', ' ')}</td>
                  <td className="px-5 py-2.5 text-right font-mono tabular-nums">{g.last_a1c ? `${g.last_a1c}%` : '—'}</td>
                  <td className="px-5 py-2.5 text-xs text-muted-foreground">{formatDate(g.last_a1c_date)}</td>
                  <td className="px-5 py-2.5 text-right font-mono tabular-nums text-xs">{g.days_since_last ?? '—'}</td>
                  <td className="px-5 py-2.5">
                    <span className={`clinical-badge ${g.gap_status === 'overdue_high_risk' ? 'clinical-badge-high' : g.gap_status === 'never' ? 'clinical-badge-high' : 'clinical-badge-borderline'} text-[9px]`}>
                      {g.gap_status === 'overdue_high_risk' ? 'High risk' : g.gap_status === 'never' ? 'Never' : 'Overdue'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {a1cGaps.length > 100 && (
          <div className="px-5 py-3 bg-muted/30 text-xs text-muted-foreground text-center">
            Showing 100 of {a1cGaps.length}. Export CSV for full list.
          </div>
        )}
      </section>

      <section className="bg-card rounded-2xl border border-border overflow-hidden">
        <header className="px-5 py-4 border-b border-border">
          <h2 className="font-display text-lg">Kidney monitoring gaps ({kidneyGaps.length})</h2>
          <p className="text-xs text-muted-foreground mt-0.5">ADA: eGFR + urine ACR annually</p>
        </header>
        {kidneyGaps.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No kidney monitoring gaps.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr className="text-left font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="px-5 py-2.5 font-medium">Patient</th>
                <th className="px-5 py-2.5 font-medium">Last eGFR</th>
                <th className="px-5 py-2.5 font-medium">Last ACR</th>
                <th className="px-5 py-2.5 font-medium">Missing</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {kidneyGaps.slice(0, 100).map((g) => (
                <tr key={g.patient_id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-5 py-2.5">
                    <Link href={`/app/patients/${g.patient_id}`} className="font-medium hover:text-accent">
                      {g.last_name}, {g.first_name}
                    </Link>
                    <span className="text-[10px] font-mono text-muted-foreground ml-2">{g.mrn}</span>
                  </td>
                  <td className="px-5 py-2.5 text-xs text-muted-foreground">{formatDate(g.last_egfr_date) || 'Never'}</td>
                  <td className="px-5 py-2.5 text-xs text-muted-foreground">{formatDate(g.last_acr_date) || 'Never'}</td>
                  <td className="px-5 py-2.5">
                    <span className="text-xs">
                      {g.egfr_overdue && <span className="clinical-badge clinical-badge-borderline text-[9px] mr-1">eGFR</span>}
                      {g.acr_overdue && <span className="clinical-badge clinical-badge-borderline text-[9px]">ACR</span>}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, tone, sub }: { label: string; value: string | number; tone?: 'good' | 'warn' | 'bad'; sub?: string }) {
  const t = tone === 'good' ? 'border-green-300 dark:border-green-800' : tone === 'warn' ? 'border-amber-300 dark:border-amber-800' : tone === 'bad' ? 'border-red-300 dark:border-red-800' : '';
  return (
    <div className={`bg-card rounded-2xl border ${t || 'border-border'} p-4`}>
      <div className="font-display text-2xl tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
      {sub && <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/60 mt-0.5">{sub}</div>}
    </div>
  );
}
