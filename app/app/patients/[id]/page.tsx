import { createClient } from '@/lib/supabase/server';
import { calculateAge, diabetesTypeLabel, formatDate, a1cBand } from '@/lib/utils';
import { logAudit } from '@/lib/audit';
import { notFound } from 'next/navigation';
import { ArrowLeft, FileText, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import Link from 'next/link';
import { A1cSparkline } from '@/components/charts/a1c-sparkline';
import { A1cTrendChart } from '@/components/charts/a1c-trend-chart';
import { GlucoseDashboard } from '@/components/charts/glucose-dashboard';

export const metadata = { title: 'Patient' };

export default async function PatientDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [
    { data: patient, error },
    { data: a1cs },
    { data: meds },
    { data: encounters },
  ] = await Promise.all([
    supabase
      .from('patients')
      .select('*, primary_provider:users!patients_primary_provider_id_fkey(id, full_name, credentials)')
      .eq('id', params.id)
      .is('deleted_at', null)
      .single(),
    supabase
      .from('lab_values')
      .select('id, value, unit, collected_at, reference_high')
      .eq('patient_id', params.id)
      .eq('test_name', 'a1c')
      .is('deleted_at', null)
      .order('collected_at', { ascending: false })
      .limit(12),
    supabase
      .from('medications')
      .select('id, name, brand_name, dose, route, frequency, is_diabetes_med')
      .eq('patient_id', params.id)
      .is('discontinued_at', null)
      .is('deleted_at', null)
      .order('is_diabetes_med', { ascending: false }),
    supabase
      .from('encounters')
      .select('id, encounter_type, status, signed_at, scheduled_at, chief_complaint')
      .eq('patient_id', params.id)
      .is('deleted_at', null)
      .order('scheduled_at', { ascending: false, nullsFirst: false })
      .limit(5),
  ]);

  if (error || !patient) return notFound();

  if (user) {
    await logAudit({
      organizationId: patient.organization_id,
      userId: user.id,
      action: 'read',
      resourceType: 'patient',
      resourceId: patient.id,
      patientId: patient.id,
    });
  }

  const latestA1c = a1cs?.[0];
  const band = latestA1c ? a1cBand(Number(latestA1c.value)) : null;

  // Compute A1C delta (latest vs second-most-recent)
  let a1cDelta: { value: number; direction: 'up' | 'down' | 'stable' } | null = null;
  if (a1cs && a1cs.length >= 2) {
    const delta = Number(a1cs[0].value) - Number(a1cs[1].value);
    if (Math.abs(delta) < 0.05) a1cDelta = { value: 0, direction: 'stable' };
    else if (delta > 0) a1cDelta = { value: delta, direction: 'up' };
    else a1cDelta = { value: Math.abs(delta), direction: 'down' };
  }

  const sparklineData = (a1cs ?? []).map((a) => ({
    collected_at: a.collected_at,
    value: Number(a.value),
  }));

  return (
    <div className="space-y-8">
      <Link href="/app/patients" className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3 w-3" /> All patients
      </Link>

      <header className="flex items-start justify-between gap-6 flex-wrap">
        <div className="space-y-2">
          <h1 className="font-display text-4xl tracking-tight">{patient.last_name}, {patient.first_name}</h1>
          <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
            <span className="font-mono">MRN {patient.mrn}</span>
            <span>·</span><span>{calculateAge(patient.date_of_birth)} yrs</span>
            <span>·</span><span className="capitalize">{patient.sex_at_birth}</span>
            <span>·</span><span>{diabetesTypeLabel(patient.diabetes_type)}</span>
            {patient.diagnosis_date && (<><span>·</span><span>Dx {formatDate(patient.diagnosis_date)}</span></>)}
          </div>
          {patient.primary_provider && (
            <p className="text-xs text-muted-foreground">
              PCP: {(patient.primary_provider as any).full_name}
              {(patient.primary_provider as any).credentials && (<span> · {(patient.primary_provider as any).credentials}</span>)}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Link href={`/app/patients/${patient.id}/labs`} className="inline-flex items-center gap-2 h-10 px-4 rounded-full border border-input bg-card text-sm font-medium hover:bg-muted transition-colors">
            All labs
          </Link>
          <Link href={`/app/encounters/new?patient=${patient.id}`} className="inline-flex items-center gap-2 h-10 px-5 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-accent transition-colors">
            <FileText className="h-4 w-4" />
            New encounter
          </Link>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Latest A1C"
          value={latestA1c ? `${latestA1c.value}%` : '—'}
          sub={latestA1c ? formatDate(latestA1c.collected_at) : 'No data'}
          tone={band?.tone}
        >
          <div className="space-y-2 mt-2">
            {band && <div className="text-xs text-muted-foreground">{band.label}</div>}
            {a1cDelta && (
              <div className="inline-flex items-center gap-1 text-[11px] font-mono">
                {a1cDelta.direction === 'up' && <TrendingUp className="h-3 w-3 text-red-600" />}
                {a1cDelta.direction === 'down' && <TrendingDown className="h-3 w-3 text-green-600" />}
                {a1cDelta.direction === 'stable' && <Minus className="h-3 w-3 text-muted-foreground" />}
                <span className={
                  a1cDelta.direction === 'up' ? 'text-red-700 dark:text-red-300' :
                  a1cDelta.direction === 'down' ? 'text-green-700 dark:text-green-300' :
                  'text-muted-foreground'
                }>
                  {a1cDelta.direction === 'stable' ? 'Stable' : `${a1cDelta.direction === 'up' ? '+' : '-'}${a1cDelta.value.toFixed(1)}% vs prior`}
                </span>
              </div>
            )}
            {sparklineData.length >= 2 && (
              <div className="-mx-2">
                <A1cSparkline data={sparklineData} height={40} />
              </div>
            )}
          </div>
        </MetricCard>
        <MetricCard label="Time in Range (14d)" value="—" sub="CGM not connected" tone="muted" />
        <MetricCard label="Active medications" value={meds?.length ?? 0} sub={`${meds?.filter((m) => m.is_diabetes_med).length ?? 0} diabetes`} />
        <MetricCard label="Last visit" value={encounters?.[0] ? formatDate(encounters[0].signed_at ?? encounters[0].scheduled_at) : 'None'} sub={encounters?.[0]?.encounter_type?.replace('_', ' ') ?? '—'} />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 bg-card rounded-2xl border border-border">
          <header className="px-6 py-5 border-b border-border flex items-center justify-between">
            <h2 className="font-display text-xl">A1C Trend</h2>
            {a1cs && a1cs.length > 0 && (
              <Link
                href={`/app/patients/${patient.id}/labs`}
                className="text-xs font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground"
              >
                All labs →
              </Link>
            )}
          </header>
          <A1cTrendChart data={sparklineData} target={7.0} height={300} />
        </section>

        <section className="bg-card rounded-2xl border border-border">
          <header className="px-6 py-5 border-b border-border"><h2 className="font-display text-xl">Active Medications</h2></header>
          {!meds || meds.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-muted-foreground">No active medications.</div>
          ) : (
            <ul className="divide-y divide-border">
              {meds.map((m) => (
                <li key={m.id} className="px-6 py-4">
                  <div className="font-medium">
                    {m.brand_name ? `${m.brand_name} (${m.name})` : m.name}
                    {m.is_diabetes_med && (<span className="ml-2 clinical-badge clinical-badge-good">DM</span>)}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 font-mono">{[m.dose, m.route, m.frequency].filter(Boolean).join(' · ')}</div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <GlucoseDashboard patientId={patient.id} hasCgm={false} />

      <section className="bg-card rounded-2xl border border-border">
        <header className="flex items-center justify-between px-6 py-5 border-b border-border"><h2 className="font-display text-xl">Recent Encounters</h2></header>
        {!encounters || encounters.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-muted-foreground">No encounters yet.</div>
        ) : (
          <ul className="divide-y divide-border">
            {encounters.map((e) => (
              <li key={e.id}>
                <Link href={`/app/encounters/${e.id}`} className="block px-6 py-4 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium capitalize">{e.encounter_type.replace(/_/g, ' ')}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {e.chief_complaint ?? 'No chief complaint recorded'} · {formatDate(e.signed_at ?? e.scheduled_at)}
                      </div>
                    </div>
                    <span className={`clinical-badge clinical-badge-${e.status === 'signed' ? 'good' : 'borderline'} capitalize`}>{e.status.replace('_', ' ')}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function MetricCard({ label, value, sub, tone = 'default', children }: { label: string; value: string | number; sub?: string; tone?: 'default' | 'good' | 'borderline' | 'high' | 'critical' | 'muted'; children?: React.ReactNode }) {
  const toneClasses = {
    default: '',
    good: 'border-green-200 dark:border-green-900',
    borderline: 'border-amber-200 dark:border-amber-900',
    high: 'border-red-200 dark:border-red-900',
    critical: 'border-red-400 dark:border-red-700 ring-2 ring-red-300/40',
    muted: 'opacity-60',
  }[tone];

  return (
    <div className={`bg-card rounded-2xl border ${toneClasses || 'border-border'} p-5`}>
      <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-display text-3xl tabular-nums mt-2">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
      {children}
    </div>
  );
}
