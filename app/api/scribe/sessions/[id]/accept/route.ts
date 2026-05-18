import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit';
import { z } from 'zod';

const AcceptSchema = z.object({
  draft_id: z.string().uuid(),
  encounter_id: z.string().uuid().optional(),
  // Edited SOAP fields (provider may have made changes)
  chief_complaint: z.string().nullable().optional(),
  subjective: z.any().optional(),
  objective: z.any().optional(),
  assessment: z.any().optional(),
  plan: z.any().optional(),
});

/**
 * POST /api/scribe/sessions/[id]/accept
 * Provider accepts the (possibly edited) draft. Either:
 *   - Updates an existing encounter_id with the SOAP content
 *   - Creates a new encounter
 * Marks session as 'accepted'. The session retains audio per retention policy.
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
    body = AcceptSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  const { data: session } = await supabase
    .from('scribe_sessions')
    .select('id, organization_id, patient_id, provider_id, status, encounter_id')
    .eq('id', params.id)
    .is('deleted_at', null)
    .single();

  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (session.provider_id !== user.id) {
    return NextResponse.json({ error: 'Only the recording provider can accept' }, { status: 403 });
  }
  if (session.status !== 'ready') {
    return NextResponse.json({ error: `Cannot accept from status '${session.status}'` }, { status: 409 });
  }

  // Strip source_segments/confidence from sections before writing to encounter
  // (those are scribe-only metadata; encounters keep clean SOAP)
  function stripScribeMeta(field: any) {
    if (!field?.sections) return field;
    return {
      sections: field.sections.map((s: any) => ({
        id: s.id,
        label: s.label,
        content: s.content,
        prompt: s.prompt,
      })),
    };
  }

  const encounterFields = {
    chief_complaint: body.chief_complaint ?? null,
    subjective: stripScribeMeta(body.subjective ?? { sections: [] }),
    objective: stripScribeMeta(body.objective ?? { sections: [] }),
    assessment: stripScribeMeta(body.assessment ?? { sections: [] }),
    plan: stripScribeMeta(body.plan ?? { sections: [] }),
  };

  let encounterId = body.encounter_id ?? session.encounter_id;

  if (encounterId) {
    // Update existing encounter
    const { error } = await supabase
      .from('encounters')
      .update({
        ...encounterFields,
        status: 'in_progress',
      })
      .eq('id', encounterId);
    if (error) {
      return NextResponse.json({ error: 'Could not update encounter' }, { status: 500 });
    }
  } else {
    // Create new encounter
    const { data: profile } = await supabase
      .from('users')
      .select('organization_id')
      .eq('id', user.id)
      .single();
    if (!profile) return NextResponse.json({ error: 'No profile' }, { status: 403 });

    const { data: newEnc, error: encErr } = await supabase
      .from('encounters')
      .insert({
        organization_id: profile.organization_id,
        patient_id: session.patient_id,
        provider_id: user.id,
        encounter_type: 'follow_up',
        status: 'in_progress',
        started_at: new Date().toISOString(),
        ...encounterFields,
      })
      .select('id')
      .single();

    if (encErr || !newEnc) {
      console.error('[scribe accept] encounter insert failed', encErr);
      return NextResponse.json({ error: 'Could not create encounter' }, { status: 500 });
    }
    encounterId = newEnc.id;
  }

  // Mark session accepted + link to encounter
  await supabase
    .from('scribe_sessions')
    .update({ status: 'accepted', encounter_id: encounterId, completed_at: new Date().toISOString() })
    .eq('id', session.id);

  // Audit
  await supabase.from('scribe_audit').insert({
    session_id: session.id,
    draft_id: body.draft_id,
    organization_id: session.organization_id,
    user_id: user.id,
    action: 'accept',
    metadata: { encounter_id: encounterId },
  });

  await logAudit({
    organizationId: session.organization_id,
    userId: user.id,
    action: 'update',
    resourceType: 'scribe_session',
    resourceId: session.id,
    patientId: session.patient_id,
    metadata: { event: 'accepted', encounter_id: encounterId },
  });

  return NextResponse.json({ ok: true, encounter_id: encounterId });
}
