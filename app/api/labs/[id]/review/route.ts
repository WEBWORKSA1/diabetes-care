import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit';
import { z } from 'zod';

const ReviewSchema = z.object({
  action: z.enum(['acknowledged', 'flagged', 'escalated', 'no_action']).default('acknowledged'),
  note: z.string().max(500).optional(),
});

/**
 * POST /api/labs/[id]/review
 * Mark a lab value as reviewed with optional action + note.
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  let body;
  try {
    body = ReviewSchema.parse(await request.json().catch(() => ({})));
  } catch (err) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  const { data: lab } = await supabase
    .from('lab_values')
    .select('id, organization_id, patient_id, test_name, value, unit, reviewed_at')
    .eq('id', params.id)
    .is('deleted_at', null)
    .single();

  if (!lab) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (lab.reviewed_at) {
    return NextResponse.json({ error: 'Already reviewed', reviewed_at: lab.reviewed_at }, { status: 409 });
  }

  const { error } = await supabase
    .from('lab_values')
    .update({
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
      review_action: body.action,
      review_note: body.note ?? null,
    })
    .eq('id', lab.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({
    organizationId: lab.organization_id,
    userId: user.id,
    action: 'update',
    resourceType: 'lab_value',
    resourceId: lab.id,
    patientId: lab.patient_id,
    metadata: { event: 'lab_reviewed', action: body.action, test_name: lab.test_name },
  });

  return NextResponse.json({ ok: true });
}
