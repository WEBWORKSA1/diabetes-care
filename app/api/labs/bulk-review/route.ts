import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit';
import { z } from 'zod';

const BulkSchema = z.object({
  lab_ids: z.array(z.string().uuid()).min(1).max(100),
  action: z.enum(['acknowledged', 'flagged', 'escalated', 'no_action']).default('acknowledged'),
  note: z.string().max(500).optional(),
});

/**
 * POST /api/labs/bulk-review
 * Mark multiple labs as reviewed in a single call. Used by inbox bulk-action.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  let body;
  try {
    body = BulkSchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json({ error: 'Invalid input', details: (err as Error).message }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single();
  if (!profile) return NextResponse.json({ error: 'No profile' }, { status: 403 });

  const { data: updated, error } = await supabase
    .from('lab_values')
    .update({
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
      review_action: body.action,
      review_note: body.note ?? null,
    })
    .in('id', body.lab_ids)
    .is('reviewed_at', null)
    .select('id, patient_id, test_name');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Audit one row per updated lab
  for (const lab of updated ?? []) {
    await logAudit({
      organizationId: profile.organization_id,
      userId: user.id,
      action: 'update',
      resourceType: 'lab_value',
      resourceId: lab.id,
      patientId: lab.patient_id,
      metadata: { event: 'lab_reviewed_bulk', action: body.action, test_name: lab.test_name },
    });
  }

  return NextResponse.json({
    ok: true,
    updated_count: updated?.length ?? 0,
  });
}
