import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit';

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { data: pattern } = await supabase
    .from('cgm_patterns')
    .select('id, organization_id, patient_id, pattern_type, acknowledged_at')
    .eq('id', params.id)
    .single();

  if (!pattern) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (pattern.acknowledged_at) return NextResponse.json({ ok: true, already: true });

  const { error } = await supabase
    .from('cgm_patterns')
    .update({
      acknowledged_at: new Date().toISOString(),
      acknowledged_by: user.id,
    })
    .eq('id', params.id);

  if (error) {
    return NextResponse.json({ error: 'Could not acknowledge' }, { status: 500 });
  }

  await logAudit({
    organizationId: pattern.organization_id,
    userId: user.id,
    action: 'update',
    resourceType: 'cgm_pattern_ack',
    resourceId: pattern.id,
    patientId: pattern.patient_id,
    metadata: { pattern_type: pattern.pattern_type },
  });

  return NextResponse.json({ ok: true });
}
