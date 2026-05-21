'use client';

import { useState, useMemo } from 'react';
import { Download, TrendingUp, TrendingDown, Minus, AlertTriangle, Plus } from 'lucide-react';
import { LabTrendChart } from '@/components/charts/lab-trend-chart';
import { LabEntryModal } from '@/components/labs/lab-entry-modal';
import { summarizeLabs, labsToCSV, downloadCSV, type LabRow } from '@/lib/clinical/lab-analytics';
import { formatDate } from '@/lib/utils';

export function LabsView({
  labs,
  patientId,
  patientName,
  patientMrn,
}: {
  labs: LabRow[];
  patientId: string;
  patientName: string;
  patientMrn: string;
}) {
  const [showAbnormalOnly, setShowAbnormalOnly] = useState(false);
  const [selectedTest, setSelectedTest] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState<string | null>(null);

  const summaries = useMemo(() => summarizeLabs(labs), [labs]);
  const filtered = showAbnormalOnly
    ? summaries.filter((s) => s.values.some((v) => v.is_abnormal))
    : summaries;

  const totalAbnormal = labs.filter((l) => l.is_abnormal).length;

  function handleExport() {
    const csv = labsToCSV(labs, patientName, patientMrn);
    const safeName = patientName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const date = new Date().toISOString().slice(0, 10);
    downloadCSV(csv, `labs_${safeName}_${date}.csv`);
  }

  return (
    <div className="space-y-6">
      {labs.length === 0 ? (
        <section className="bg-card rounded-2xl border border-border px-6 py-16 text-center">
          <p className="font-display text-lg">No lab results recorded</p>
          <p className="text-sm text-muted-foreground mt-1">Add the patient&rsquo;s first lab to start tracking trends.</p>
          <button
            onClick={() => setShowAdd('a1c')}
            className="inline-flex items-center gap-2 mt-6 h-10 px-5 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-accent transition-colors"
          >
            <Plus className="h-4 w-4" /> Add first lab
          </button>
        </section>
      ) : (
        <>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4 text-sm flex-wrap">
              <div>
                <span className="font-display text-2xl tabular-nums">{labs.length}</span>
                <span className="text-muted-foreground ml-1">total</span>
              </div>
              <div>
                <span className="font-display text-2xl tabular-nums text-red-700 dark:text-red-300">{totalAbnormal}</span>
                <span className="text-muted-foreground ml-1">abnormal</span>
              </div>
              <div>
                <span className="font-display text-2xl tabular-nums">{summaries.length}</span>
                <span className="text-muted-foreground ml-1">tests</span>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={showAbnormalOnly} onChange={(e) => setShowAbnormalOnly(e.target.checked)} className="rounded" />
                Abnormal only
              </label>
              <button onClick={handleExport} className="inline-flex items-center gap-2 h-9 px-4 rounded-full border border-input bg-card text-sm font-medium hover:bg-muted transition-colors">
                <Download className="h-4 w-4" /> Export CSV
              </button>
              <button onClick={() => setShowAdd('a1c')} className="inline-flex items-center gap-2 h-9 px-4 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-accent transition-colors">
                <Plus className="h-4 w-4" /> Add lab
              </button>
            </div>
          </div>

          {filtered.length === 0 ? (
            <section className="bg-card rounded-2xl border border-border px-6 py-12 text-center">
              <p className="font-display text-lg">No abnormal results</p>
              <p className="text-sm text-muted-foreground mt-1">All recorded values are within reference range.</p>
            </section>
          ) : (
            <div className="grid lg:grid-cols-2 gap-6">
              {filtered.map((summary) => {
                const latest = summary.latest;
                const isAbnormal = latest?.is_abnormal;
                const trendIcon = summary.trend === 'up' ? TrendingUp : summary.trend === 'down' ? TrendingDown : Minus;
                const TrendIcon = trendIcon;
                const isExpanded = selectedTest === summary.test_name;

                return (
                  <section key={summary.test_name} className="bg-card rounded-2xl border border-border overflow-hidden">
                    <header className="px-5 py-4 border-b border-border">
                      <div className="flex items-center justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => setSelectedTest(isExpanded ? null : summary.test_name)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <h3 className="font-display text-lg flex items-center gap-2">
                            {summary.label}
                            {isAbnormal && <AlertTriangle className="h-3.5 w-3.5 text-red-600" />}
                          </h3>
                          <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground mt-0.5">
                            {summary.count} result{summary.count === 1 ? '' : 's'}
                            {summary.refLow != null && summary.refHigh != null && (
                              <span> · ref {summary.refLow}–{summary.refHigh} {summary.unit}</span>
                            )}
                          </div>
                        </button>
                        {latest && (
                          <div className="text-right shrink-0">
                            <div className={`font-display text-2xl tabular-nums ${isAbnormal ? 'text-red-700 dark:text-red-300' : ''}`}>
                              {Number(latest.value).toFixed(latest.value.toString().includes('.') ? 2 : 1)}
                              <span className="text-xs text-muted-foreground ml-1">{summary.unit}</span>
                            </div>
                            {summary.count >= 2 && summary.trendPercent != null && (
                              <div className="text-[10px] font-mono text-muted-foreground inline-flex items-center gap-0.5 mt-0.5">
                                <TrendIcon className="h-2.5 w-2.5" />
                                {summary.trendPercent > 0 ? '+' : ''}{summary.trendPercent.toFixed(1)}%
                              </div>
                            )}
                          </div>
                        )}
                        <button
                          onClick={() => setShowAdd(summary.test_name)}
                          className="shrink-0 h-8 w-8 rounded-full border border-input bg-card flex items-center justify-center hover:bg-muted transition-colors"
                          title={`Add ${summary.label}`}
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </header>

                    <LabTrendChart
                      data={summary.values}
                      label={summary.label}
                      unit={summary.unit}
                      refLow={summary.refLow}
                      refHigh={summary.refHigh}
                      height={isExpanded ? 280 : 180}
                    />

                    {isExpanded && (
                      <div className="border-t border-border bg-muted/20">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left font-mono text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
                              <th className="px-5 py-2 font-medium">Date</th>
                              <th className="px-5 py-2 font-medium text-right">Value</th>
                              <th className="px-5 py-2 font-medium">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {summary.values.map((v) => (
                              <tr key={v.id} className="hover:bg-muted/30 transition-colors">
                                <td className="px-5 py-2 font-mono text-xs">{formatDate(v.collected_at)}</td>
                                <td className={`px-5 py-2 text-right font-mono tabular-nums ${v.is_abnormal ? 'text-red-700 dark:text-red-300 font-medium' : ''}`}>
                                  {Number(v.value).toFixed(2)} {v.unit}
                                </td>
                                <td className="px-5 py-2">
                                  {v.is_abnormal === true && <span className="clinical-badge clinical-badge-high">Abnormal</span>}
                                  {v.is_abnormal === false && <span className="clinical-badge clinical-badge-good">Normal</span>}
                                  {v.is_abnormal === null && <span className="text-xs text-muted-foreground">—</span>}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          )}
        </>
      )}

      {showAdd && (
        <LabEntryModal
          patientId={patientId}
          defaultTest={showAdd}
          onClose={() => setShowAdd(null)}
        />
      )}
    </div>
  );
}
