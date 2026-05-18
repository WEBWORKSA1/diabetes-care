import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit';
import { z } from 'zod';

const ThresholdSchema = z.object({
  patient_id: z.string().uuid(),
  target_low: z.number().min(40).max(120).optional(),
  target_high: z.number().min(120).max(300).optional(),
  urgent_low: z.number().min(40).max(80).optional(),
  urgent_high: z.number().min(200).max(400).optional(),
  alert_nocturnal_hypo: z.boolean().optional(),
  alert_postprandial_spike: z.boolean().optional(),
  alert_dawn_phenomenon: z.boolean().optional(),
  alert_high_variability: z.boolean().optional(),
  cv_threshold: z.number().min(15).max(80).optional(),
});

/**
 * POST /api/cgm/thresholds
 * Upsert per-patient CGM thresholds. Replaces existing if any.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  let body;
  try {
    body = ThresholdSchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json({ error: 'Invalid input', details: (err as Error).message }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single();
  if (!profile) return NextResponse.json({ error: 'No profile' }, { status: 403 });

  // Validate target_low < target_high, urgent_low < target_low, etc.
  const tl = body.target_low ?? 70;
  const th = body.target_high ?? 180;
  const ul = body.urgent_low ?? 54;
  const uh = body.urgent_high ?? 250;
  if (ul >= tl || tl >= th || th >= uh) {
    return NextResponse.json({ error: 'Threshold ordering invalid: urgent_low < target_low < target_high < urgent_high' }, { status: 400 });
  }

  const upsertPayload = {
    organization_id: profile.organization_id,
    patient_id: body.patient_id,
    target_low: tl,
    target_high: th,
    urgent_low: ul,
    urgent_high: uh,
    alert_nocturnal_hypo: body.alert_nocturnal_hypo ?? true,
    alert_postprandial_spike: body.alert_postprandial_spike ?? true,
    alert_dawn_phenomenon: body.alert_dawn_phenomenon ?? true,
    alert_high_variability: body.alert_high_variability ?? true,
    cv_threshold: body.cv_threshold ?? 36,
    set_by: user.id,
  };

  const { data, error } = await supabase
    .from('cgm_thresholds')
    .upsert(upsertPayload, { onConflict: 'patient_id' })
    .select('id')
    .single();

  if (error) {
    console.error('[thresholds] upsert failed', error);
    return NextResponse.json({ error: 'Could not save thresholds' }, { status: 500 });
  }

  await logAudit({
    organizationId: profile.organization_id,
    userId: user.id,
    action: 'update',
    resourceType: 'cgm_thresholds',
    resourceId: data.id,
    patientId: body.patient_id,
  });

  return NextResponse.json({ ok: true, id: data.id });
}

/**
 * GET /api/cgm/thresholds?patient_id=...
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const patientId = searchParams.get('patient_id');
  if (!patientId) return NextResponse.json({ error: 'patient_id required' }, { status: 400 });

  const { data } = await supabase
    .from('cgm_thresholds')
    .select('*')
    .eq('patient_id', patientId)
    .maybeSingle();

  return NextResponse.json({ thresholds: data });
}
