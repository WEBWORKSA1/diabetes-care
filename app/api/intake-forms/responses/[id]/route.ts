import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit';
import { z } from 'zod';

const PatchSchema = z.object({
  status: z.enum(['reviewed']).optional(),
  review_notes: z.string().max(1000).optional(),
});

/**
 * GET /api/intake-forms/responses/[id]
 * Practice-side view of a submitted intake response.
 */
export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { data, error } = await supabase
    .from('intake_form_responses')
    .select(`
      *,
      intake_forms(id, name, kind, fields, description),
      patients(id, first_name, last_name, mrn),
      reviewer:users!intake_form_responses_reviewed_by_fkey(full_name)
    `)
    .eq('id', params.id)
    .single();

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ response: data });
}

/**
 * PATCH /api/intake-forms/responses/[id]
 * Mark response as reviewed.
 */
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  let body;
  try {
    body = PatchSchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from('intake_form_responses')
    .select('id, organization_id, patient_id, status')
    .eq('id', params.id)
    .single();
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const update: any = {};
  if (body.status === 'reviewed') {
    update.status = 'reviewed';
    update.reviewed_at = new Date().toISOString();
    update.reviewed_by = user.id;
  }
  if (body.review_notes !== undefined) update.review_notes = body.review_notes;

  const { error } = await supabase.from('intake_form_responses').update(update).eq('id', existing.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({
    organizationId: existing.organization_id,
    userId: user.id,
    action: 'update',
    resourceType: 'intake_form_response',
    resourceId: existing.id,
    patientId: existing.patient_id,
    metadata: { event: body.status === 'reviewed' ? 'reviewed' : 'note_added' },
  });

  return NextResponse.json({ ok: true });
}
