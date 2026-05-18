import { createClient } from '@/lib/supabase/server';
import { calculateAge, diabetesTypeLabel, formatDate, a1cBand } from '@/lib/utils';
import { logAudit } from '@/lib/audit';
import { notFound } from 'next/navigation';
import { ArrowLeft, FileText } from 'lucide-react';
import Link from 'next/link';

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
      .limit(8),
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
        <div className="flex items-center gap-3">
          <Link href={`/app/encounters/new?patient=${patient.id}`} className="inline-flex items-center gap-2 h-10 px-5 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-accent transition-colors">
            <FileText className="h-4 w-4" />
            New encounter
          </Link>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Latest A1C" value={latestA1c ? `${latestA1c.value}%` : '—'} sub={latestA1c ? formatDate(latestA1c.collected_at) : 'No data'} tone={band?.tone}>
          {band && <div className="text-xs mt-2 text-muted-foreground">{band.label}</div>}
        </MetricCard>
        <MetricCard label="Time in Range (14d)" value="—" sub="CGM not connected" tone="muted" />
        <MetricCard label="Active medications" value={meds?.length ?? 0} sub={`${meds?.filter((m) => m.is_diabetes_med).length ?? 0} diabetes`} />
        <MetricCard label="Last visit" value={encounters?.[0] ? formatDate(encounters[0].signed_at ?? encounters[0].scheduled_at) : 'None'} sub={encounters?.[0]?.encounter_type?.replace('_', ' ') ?? '—'} />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 bg-card rounded-2xl border border-border">
          <header className="px-6 py-5 border-b border-border"><h2 className="font-display text-xl">A1C History</h2></header>
          {!a1cs || a1cs.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-muted-foreground">No A1C values recorded yet.</div>
          ) : (
            <ul className="divide-y divide-border">
              {a1cs.map((lab) => {
                const v = Number(lab.value);
                const b = a1cBand(v);
                return (
                  <li key={lab.id} className="px-6 py-4 flex items-center justify-between">
                    <div>
                      <div className="font-mono text-sm tabular-nums">{formatDate(lab.collected_at)}</div>
                      <div className={`clinical-badge clinical-badge-${b.tone === 'good' ? 'good' : b.tone === 'borderline' ? 'borderline' : 'high'} mt-1`}>{b.label}</div>
                    </div>
                    <div className="font-display text-2xl tabular-nums">{v}%</div>
                  </li>
                );
              })}
            </ul>
          )}
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
