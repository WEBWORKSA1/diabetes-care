import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit';
import { z } from 'zod';

const LabSchema = z.object({
  patient_id: z.string().uuid(),
  test_name: z.enum(['a1c', 'fasting_glucose', 'random_glucose', 'ldl', 'hdl', 'triglycerides', 'total_cholesterol', 'egfr', 'creatinine', 'urine_acr', 'tsh']),
  value: z.number(),
  unit: z.string().min(1).max(20),
  collected_at: z.string().regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?(\.\d+)?Z?)?$/),
  reference_low: z.number().optional(),
  reference_high: z.number().optional(),
  source: z.enum(['manual', 'lab_feed', 'patient_reported']).default('manual'),
  notes: z.string().max(500).optional(),
});

/**
 * POST /api/labs
 * Manually enter a lab value. Used until HL7/lab feed integration exists.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  let body;
  try {
    body = LabSchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json({ error: 'Invalid input', details: (err as Error).message }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single();
  if (!profile) return NextResponse.json({ error: 'No profile' }, { status: 403 });

  // Normalize collected_at to ISO if it's date-only
  const collectedAt = body.collected_at.includes('T') ? body.collected_at : `${body.collected_at}T12:00:00Z`;

  const insertRow: any = {
    organization_id: profile.organization_id,
    patient_id: body.patient_id,
    test_name: body.test_name,
    value: body.value,
    unit: body.unit,
    collected_at: collectedAt,
    source: body.source,
    entered_by: user.id,
  };
  if (body.reference_low !== undefined) insertRow.reference_low = body.reference_low;
  if (body.reference_high !== undefined) insertRow.reference_high = body.reference_high;
  if (body.notes) insertRow.notes = body.notes;

  const { data, error } = await supabase
    .from('lab_values')
    .insert(insertRow)
    .select('id')
    .single();

  if (error) {
    console.error('[labs] insert failed', error);
    return NextResponse.json({ error: 'Could not save lab', details: error.message }, { status: 500 });
  }

  await logAudit({
    organizationId: profile.organization_id,
    userId: user.id,
    action: 'create',
    resourceType: 'lab_value',
    resourceId: data.id,
    patientId: body.patient_id,
    metadata: { test_name: body.test_name, value: body.value },
  });

  return NextResponse.json({ id: data.id });
}
