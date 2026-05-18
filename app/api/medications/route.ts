import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit';
import { z } from 'zod';

const AddMedSchema = z.object({
  patient_id: z.string().uuid(),
  name: z.string().min(1).max(120),
  brand_name: z.string().max(120).optional(),
  dose: z.string().max(60).optional(),
  route: z.string().max(40).optional(),
  frequency: z.string().max(80).optional(),
  indication: z.string().max(120).optional(),
  is_diabetes_med: z.boolean().default(false),
  instructions: z.string().max(500).optional(),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  let payload;
  try {
    payload = AddMedSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single();
  if (!profile) return NextResponse.json({ error: 'No profile' }, { status: 403 });

  const { data: med, error } = await supabase
    .from('medications')
    .insert({
      organization_id: profile.organization_id,
      patient_id: payload.patient_id,
      name: payload.name,
      brand_name: payload.brand_name ?? null,
      dose: payload.dose ?? null,
      route: payload.route ?? null,
      frequency: payload.frequency ?? null,
      indication: payload.indication ?? null,
      is_diabetes_med: payload.is_diabetes_med,
      instructions: payload.instructions ?? null,
      prescribed_by: user.id,
      prescribed_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error) {
    console.error('[medications] create failed', error);
    return NextResponse.json({ error: 'Could not add medication' }, { status: 500 });
  }

  await logAudit({
    organizationId: profile.organization_id,
    userId: user.id,
    action: 'create',
    resourceType: 'medication',
    resourceId: med.id,
    patientId: payload.patient_id,
    metadata: { name: payload.name, brand: payload.brand_name, is_diabetes_med: payload.is_diabetes_med },
  });

  return NextResponse.json({ id: med.id });
}
