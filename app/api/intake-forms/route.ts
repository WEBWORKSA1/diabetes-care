import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit';
import { DEFAULT_FORMS } from '@/lib/portal/default-forms';
import { z } from 'zod';

const FormFieldSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(['text', 'textarea', 'number', 'select', 'radio', 'checkbox', 'date', 'scale']),
  required: z.boolean().optional(),
  options: z.array(z.string()).optional(),
  scale_min: z.number().optional(),
  scale_max: z.number().optional(),
  scale_min_label: z.string().optional(),
  scale_max_label: z.string().optional(),
  help_text: z.string().optional(),
  placeholder: z.string().optional(),
});

const CreateSchema = z.object({
  name: z.string().min(1).max(200),
  kind: z.enum(['pre_visit', 'new_patient', 'glp1_screening', 'pre_op', 'symptom_check']).default('pre_visit'),
  description: z.string().max(1000).optional(),
  fields: z.array(FormFieldSchema),
  is_default_for_new_patient: z.boolean().optional(),
});

/**
 * GET /api/intake-forms
 * List intake forms for current org. Auto-seeds defaults on first call.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { data: profile } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single();
  if (!profile) return NextResponse.json({ error: 'No profile' }, { status: 403 });

  // Seed defaults if org has no forms yet
  const { count } = await supabase
    .from('intake_forms')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', profile.organization_id);

  if ((count ?? 0) === 0) {
    const admin = createServiceClient();
    for (const defaultForm of DEFAULT_FORMS) {
      await admin.from('intake_forms').insert({
        organization_id: profile.organization_id,
        name: defaultForm.name,
        kind: defaultForm.kind,
        description: defaultForm.description,
        fields: defaultForm.fields,
        is_active: true,
        created_by: user.id,
      });
    }
  }

  const { data } = await supabase
    .from('intake_forms')
    .select('*')
    .eq('is_active', true)
    .order('kind')
    .order('name');

  return NextResponse.json({ forms: data ?? [] });
}

/**
 * POST /api/intake-forms
 * Create a new intake form template.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  let body;
  try {
    body = CreateSchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json({ error: 'Invalid input', details: (err as Error).message }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single();
  if (!profile) return NextResponse.json({ error: 'No profile' }, { status: 403 });

  const { data, error } = await supabase
    .from('intake_forms')
    .insert({
      organization_id: profile.organization_id,
      name: body.name,
      kind: body.kind,
      description: body.description ?? null,
      fields: body.fields,
      is_default_for_new_patient: body.is_default_for_new_patient ?? false,
      created_by: user.id,
      is_active: true,
    })
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({
    organizationId: profile.organization_id,
    userId: user.id,
    action: 'create',
    resourceType: 'intake_form',
    resourceId: data.id,
  });

  return NextResponse.json({ id: data.id });
}
