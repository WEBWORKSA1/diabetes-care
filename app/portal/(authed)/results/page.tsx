import { getCurrentPortalSession } from '@/lib/portal/auth';
import { createServiceClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { FlaskConical, AlertTriangle, CheckCircle2 } from 'lucide-react';

export const metadata = { title: 'My results' };

const LAB_LABELS: Record<string, string> = {
  a1c: 'A1C',
  fasting_glucose: 'Fasting glucose',
  random_glucose: 'Random glucose',
  ldl: 'LDL cholesterol',
  hdl: 'HDL cholesterol',
  triglycerides: 'Triglycerides',
  total_cholesterol: 'Total cholesterol',
  egfr: 'eGFR',
  creatinine: 'Creatinine',
  urine_acr: 'Urine ACR',
  tsh: 'TSH',
};

export default async function PortalResultsPage() {
  const session = await getCurrentPortalSession();
  if (!session) redirect('/portal/signin');

  const admin = createServiceClient();
  const { data: labs } = await admin
    .from('lab_values')
    .select('id, test_name, value, unit, collected_at, reference_low, reference_high')
    .eq('patient_id', session.patient_id)
    .eq('patient_release_held', false)
    .is('deleted_at', null)
    .order('collected_at', { ascending: false })
    .limit(100);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl sm:text-3xl tracking-tight">My results</h1>
        <p className="text-sm text-muted-foreground mt-1">Lab results released to you by your provider.</p>
      </header>

      {(!labs || labs.length === 0) ? (
        <div className="py-12 text-center bg-card rounded-2xl border border-border">
          <FlaskConical className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
          <p className="font-display text-lg">No results yet</p>
          <p className="text-sm text-muted-foreground mt-1">When your provider releases lab results, they&rsquo;ll appear here.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {labs.map((l: any) => {
            const value = Number(l.value);
            const rl = l.reference_low !== null ? Number(l.reference_low) : null;
            const rh = l.reference_high !== null ? Number(l.reference_high) : null;
            const abnormal = (rl !== null && value < rl) || (rh !== null && value > rh);
            return (
              <li key={l.id} className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3">
                <div className={`p-2 rounded-lg ${abnormal ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' : 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300'}`}>
                  {abnormal ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{LAB_LABELS[l.test_name] ?? l.test_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(l.collected_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    {rl !== null && rh !== null && (<span> · ref {rl}–{rh} {l.unit}</span>)}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className={`font-display text-xl tabular-nums ${abnormal ? 'text-amber-700 dark:text-amber-300' : ''}`}>
                    {value.toFixed(2)}
                  </div>
                  <div className="text-[10px] font-mono text-muted-foreground">{l.unit}</div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-3">
        <strong>Note:</strong> Results shown here are released by your provider. If a result is missing, ask your practice. For abnormal results, follow up with your provider — even if it&rsquo;s only slightly out of range.
      </div>
    </div>
  );
}
