import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit';
import { calculateBMI, isEncounterEditable } from '@/lib/clinical/encounter';
import { z } from 'zod';

const SectionSchema = z.object({
  id: z.string(),
  label: z.string(),
  content: z.string().optional(),
  prompt: z.string().optional(),
});
const SoapFieldSchema = z.object({ sections: z.array(SectionSchema.passthrough()) });

const UpdateEncounterSchema = z.object({
  chief_complaint: z.string().max(500).nullable().optional(),
  subjective: SoapFieldSchema.optional(),
  objective: SoapFieldSchema.optional(),
  assessment: SoapFieldSchema.optional(),
  plan: SoapFieldSchema.optional(),
  vitals: z.object({
    bp_sys: z.number().int().min(40).max(300).nullable().optional(),
    bp_dia: z.number().int().min(20).max(200).nullable().optional(),
    hr: z.number().int().min(20).max(250).nullable().optional(),
    temp: z.number().min(85).max(110).nullable().optional(),
    weight_kg: z.number().min(0.5).max(500).nullable().optional(),
    height_cm: z.number().min(30).max(250).nullable().optional(),
  }).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  let payload;
  try {
    payload = UpdateEncounterSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from('encounters')
    .select('id, organization_id, patient_id, provider_id, status, signed_at, locked_at, deleted_at')
    .eq('id', params.id)
    .single();

  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (!isEncounterEditable(existing as any)) {
    return NextResponse.json({ error: 'Encounter is signed/locked and cannot be edited' }, { status: 403 });
  }

  const update: any = { updated_at: new Date().toISOString() };
  if (payload.chief_complaint !== undefined) update.chief_complaint = payload.chief_complaint;
  if (payload.subjective) update.subjective = payload.subjective;
  if (payload.objective) update.objective = payload.objective;
  if (payload.assessment) update.assessment = payload.assessment;
  if (payload.plan) update.plan = payload.plan;
  if (payload.vitals) {
    const v: any = { ...payload.vitals };
    const bmi = calculateBMI(v.weight_kg, v.height_cm);
    if (bmi !== null) v.bmi = bmi;
    update.vitals = v;
  }
  if (existing.status === 'draft') update.status = 'in_progress';

  const { error } = await supabase
    .from('encounters')
    .update(update)
    .eq('id', params.id);

  if (error) {
    console.error('[encounters] update failed', error);
    return NextResponse.json({ error: 'Could not update encounter' }, { status: 500 });
  }

  if (payload.assessment || payload.plan) {
    await logAudit({
      organizationId: existing.organization_id,
      userId: user.id,
      action: 'update',
      resourceType: 'encounter',
      resourceId: existing.id,
      patientId: existing.patient_id,
    });
  }

  return NextResponse.json({ ok: true });
}

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { data, error } = await supabase
    .from('encounters')
    .select('*, patients(id, first_name, last_name, mrn, date_of_birth, sex_at_birth, diabetes_type), provider:users!encounters_provider_id_fkey(full_name, credentials)')
    .eq('id', params.id)
    .is('deleted_at', null)
    .single();

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ encounter: data });
}
