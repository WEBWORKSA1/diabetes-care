import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getCurrentPortalSession } from '@/lib/portal/auth';
import { z } from 'zod';

const SubmitSchema = z.object({
  responses: z.record(z.any()),
});

/**
 * POST /api/portal/intake/[id]/submit
 * Patient-side: save responses + mark submitted.
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getCurrentPortalSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  let body;
  try {
    body = SubmitSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  const admin = createServiceClient();

  // Confirm response belongs to this patient and isn't already submitted
  const { data: existing } = await admin
    .from('intake_form_responses')
    .select('id, patient_id, status, expires_at')
    .eq('id', params.id)
    .single();

  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (existing.patient_id !== session.patient_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (existing.status === 'submitted' || existing.status === 'reviewed') {
    return NextResponse.json({ error: 'Already submitted' }, { status: 409 });
  }
  if (new Date(existing.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Form has expired' }, { status: 410 });
  }

  const { error } = await admin
    .from('intake_form_responses')
    .update({
      responses: body.responses,
      status: 'submitted',
      submitted_at: new Date().toISOString(),
    })
    .eq('id', params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
