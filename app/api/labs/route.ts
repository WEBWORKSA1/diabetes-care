import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit';
import { DIABETES_LABS } from '@/lib/clinical/encounter';
import { z } from 'zod';

const LabSchema = z.object({
  patient_id: z.string().uuid(),
  encounter_id: z.string().uuid().optional(),
  test_name: z.string().min(1).max(50),
  value: z.number(),
  unit: z.string().min(1).max(30),
  collected_at: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  loinc_code: z.string().optional(),
  notes: z.string().max(500).optional(),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  let payload;
  try {
    payload = LabSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single();
  if (!profile) return NextResponse.json({ error: 'No profile' }, { status: 403 });

  const known = DIABETES_LABS.find((l) => l.name === payload.test_name);
  const isAbnormal = known
    ? payload.value < known.refLow || payload.value > known.refHigh
    : null;

  const collectedISO = payload.collected_at.includes('T')
    ? payload.collected_at
    : `${payload.collected_at}T12:00:00Z`;

  const { data: lab, error } = await supabase
    .from('lab_values')
    .insert({
      organization_id: profile.organization_id,
      patient_id: payload.patient_id,
      encounter_id: payload.encounter_id ?? null,
      test_name: payload.test_name,
      loinc_code: payload.loinc_code ?? known?.loinc ?? null,
      value: payload.value,
      unit: payload.unit,
      reference_low: known?.refLow ?? null,
      reference_high: known?.refHigh ?? null,
      is_abnormal: isAbnormal,
      collected_at: collectedISO,
      resulted_at: new Date().toISOString(),
      source: 'manual',
      notes: payload.notes ?? null,
      created_by: user.id,
    })
    .select('id')
    .single();

  if (error) {
    console.error('[labs] create failed', error);
    return NextResponse.json({ error: 'Could not save lab value' }, { status: 500 });
  }

  await logAudit({
    organizationId: profile.organization_id,
    userId: user.id,
    action: 'create',
    resourceType: 'lab_value',
    resourceId: lab.id,
    patientId: payload.patient_id,
    metadata: { test_name: payload.test_name, value: payload.value, encounter_id: payload.encounter_id ?? null },
  });

  return NextResponse.json({ id: lab.id });
}
