import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit';
import { z } from 'zod';

const ThresholdSchema = z.object({
  patient_id: z.string().uuid(),
  low_threshold: z.number().int().min(40).max(100),
  critical_low_threshold: z.number().int().min(30).max(70),
  high_threshold: z.number().int().min(140).max(300),
  critical_high_threshold: z.number().int().min(200).max(600),
  target_low: z.number().int().min(50).max(100),
  target_high: z.number().int().min(140).max(250),
  alert_on_nocturnal_hypo: z.boolean().default(true),
  alert_on_postprandial_spike: z.boolean().default(true),
  alert_on_dawn_phenomenon: z.boolean().default(false),
  notes: z.string().max(500).optional(),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  let payload;
  try {
    payload = ThresholdSchema.parse(await request.json());
  } catch (e: any) {
    return NextResponse.json({ error: 'Invalid input', detail: e.message }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single();
  if (!profile) return NextResponse.json({ error: 'No profile' }, { status: 403 });

  const { data: patient } = await supabase
    .from('patients')
    .select('id')
    .eq('id', payload.patient_id)
    .single();
  if (!patient) return NextResponse.json({ error: 'Patient not accessible' }, { status: 404 });

  if (payload.critical_low_threshold >= payload.low_threshold) {
    return NextResponse.json({ error: 'Critical low must be below low threshold' }, { status: 422 });
  }
  if (payload.target_low > payload.target_high) {
    return NextResponse.json({ error: 'Target low must be below target high' }, { status: 422 });
  }

  const { data: existing } = await supabase
    .from('cgm_alert_thresholds')
    .select('id')
    .eq('patient_id', payload.patient_id)
    .is('deleted_at', null)
    .maybeSingle();

  const upsertPayload = {
    patient_id: payload.patient_id,
    organization_id: profile.organization_id,
    low_threshold: payload.low_threshold,
    critical_low_threshold: payload.critical_low_threshold,
    high_threshold: payload.high_threshold,
    critical_high_threshold: payload.critical_high_threshold,
    target_low: payload.target_low,
    target_high: payload.target_high,
    alert_on_nocturnal_hypo: payload.alert_on_nocturnal_hypo,
    alert_on_postprandial_spike: payload.alert_on_postprandial_spike,
    alert_on_dawn_phenomenon: payload.alert_on_dawn_phenomenon,
    notes: payload.notes ?? null,
  };

  let result;
  if (existing) {
    result = await supabase
      .from('cgm_alert_thresholds')
      .update(upsertPayload)
      .eq('id', existing.id);
  } else {
    result = await supabase
      .from('cgm_alert_thresholds')
      .insert(upsertPayload);
  }

  if (result.error) {
    return NextResponse.json({ error: 'Could not save thresholds' }, { status: 500 });
  }

  await logAudit({
    organizationId: profile.organization_id,
    userId: user.id,
    action: 'update',
    resourceType: 'cgm_alert_thresholds',
    patientId: payload.patient_id,
    metadata: { updated: !!existing },
  });

  return NextResponse.json({ ok: true });
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const url = new URL(request.url);
  const patientId = url.searchParams.get('patient_id');
  if (!patientId) return NextResponse.json({ error: 'patient_id required' }, { status: 400 });

  const { data } = await supabase
    .from('cgm_alert_thresholds')
    .select('*')
    .eq('patient_id', patientId)
    .is('deleted_at', null)
    .maybeSingle();

  return NextResponse.json({ thresholds: data });
}
