import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit';
import { z } from 'zod';

const CreateEncounterSchema = z.object({
  patient_id: z.string().uuid(),
  encounter_type: z.enum(['new_patient', 'follow_up', 'urgent', 'telehealth', 'lab_review', 'cgm_review', 'medication_adjustment']),
  template_slug: z.string().optional().nullable(),
  chief_complaint: z.string().max(500).optional().nullable(),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  let payload;
  try {
    payload = CreateEncounterSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single();

  if (!profile) return NextResponse.json({ error: 'No profile' }, { status: 403 });

  let subjective: any = { sections: [] };
  let objective: any = { sections: [] };
  let assessment: any = { sections: [] };
  let plan: any = { sections: [] };

  if (payload.template_slug) {
    const { data: tmpl } = await supabase
      .from('soap_templates')
      .select('subjective_template, objective_template, assessment_template, plan_template')
      .eq('slug', payload.template_slug)
      .or(`organization_id.is.null,organization_id.eq.${profile.organization_id}`)
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('organization_id', { ascending: false, nullsFirst: false })
      .limit(1)
      .single();

    if (tmpl) {
      subjective = tmpl.subjective_template || subjective;
      objective = tmpl.objective_template || objective;
      assessment = tmpl.assessment_template || assessment;
      plan = tmpl.plan_template || plan;
    }
  }

  const { data: enc, error } = await supabase
    .from('encounters')
    .insert({
      organization_id: profile.organization_id,
      patient_id: payload.patient_id,
      provider_id: user.id,
      encounter_type: payload.encounter_type,
      status: 'draft',
      started_at: new Date().toISOString(),
      chief_complaint: payload.chief_complaint ?? null,
      subjective,
      objective,
      assessment,
      plan,
    })
    .select('id')
    .single();

  if (error) {
    console.error('[encounters] create failed', error);
    return NextResponse.json({ error: 'Could not create encounter' }, { status: 500 });
  }

  await logAudit({
    organizationId: profile.organization_id,
    userId: user.id,
    action: 'create',
    resourceType: 'encounter',
    resourceId: enc.id,
    patientId: payload.patient_id,
    metadata: { template: payload.template_slug ?? null, encounter_type: payload.encounter_type },
  });

  return NextResponse.json({ id: enc.id });
}
