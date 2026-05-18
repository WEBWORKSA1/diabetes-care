import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateSoapDraft, countLowConfidenceSections } from '@/lib/scribe/llm-generators';
import { runAllGuardrails } from '@/lib/scribe/guardrails';
import { buildPatientContextString } from '@/lib/scribe/prompts';
import { logAudit } from '@/lib/audit';
import { z } from 'zod';

export const runtime = 'nodejs';
export const maxDuration = 180;

const BodySchema = z.object({
  llm: z.enum(['claude', 'gpt4o']).optional(),
  visit_type: z.string().default('follow_up'),
});

/**
 * POST /api/scribe/sessions/[id]/generate
 * Generates a SOAP draft from transcript using the org's preferred LLM (or override).
 * Returns draft_id for client to load.
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
    body = BodySchema.parse(await request.json().catch(() => ({})));
  } catch {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  const { data: session } = await supabase
    .from('scribe_sessions')
    .select(`
      id, organization_id, patient_id, provider_id, status,
      transcript_text, transcript_segments,
      patients(first_name, last_name, date_of_birth, sex_at_birth, diabetes_type, diagnosis_date)
    `)
    .eq('id', params.id)
    .is('deleted_at', null)
    .single();

  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  if (!session.transcript_text || !session.transcript_segments) {
    return NextResponse.json({ error: 'No transcript yet' }, { status: 409 });
  }
  if (!['transcribed', 'generation_failed', 'ready'].includes(session.status)) {
    return NextResponse.json({ error: `Cannot generate from status '${session.status}'` }, { status: 409 });
  }

  // Determine LLM
  let llm: 'claude' | 'gpt4o';
  if (body.llm) {
    llm = body.llm;
  } else {
    const { data: org } = await supabase
      .from('organizations')
      .select('scribe_llm_preference')
      .eq('id', session.organization_id)
      .single();
    llm = (org?.scribe_llm_preference as 'claude' | 'gpt4o') ?? 'claude';
  }

  // Load active meds + latest A1C for patient context
  const [{ data: meds }, { data: a1cs }] = await Promise.all([
    supabase
      .from('medications')
      .select('name, brand_name, dose, frequency')
      .eq('patient_id', session.patient_id)
      .is('discontinued_at', null)
      .is('deleted_at', null)
      .limit(20),
    supabase
      .from('lab_values')
      .select('value, collected_at')
      .eq('patient_id', session.patient_id)
      .eq('test_name', 'a1c')
      .is('deleted_at', null)
      .order('collected_at', { ascending: false })
      .limit(1),
  ]);

  const patient = session.patients as any;
  const patientContext = buildPatientContextString({
    first_name: patient.first_name,
    last_name: patient.last_name,
    date_of_birth: patient.date_of_birth,
    sex_at_birth: patient.sex_at_birth,
    diabetes_type: patient.diabetes_type,
    diagnosis_date: patient.diagnosis_date,
    active_meds: (meds ?? []).map((m: any) => `${m.brand_name || m.name}${m.dose ? ' ' + m.dose : ''}${m.frequency ? ' ' + m.frequency : ''}`),
    latest_a1c: a1cs?.[0] ? { value: Number(a1cs[0].value), date: a1cs[0].collected_at.slice(0, 10) } : null,
  });

  await supabase.from('scribe_sessions').update({ status: 'generating' }).eq('id', session.id);

  try {
    const result = await generateSoapDraft({
      llm,
      transcriptText: session.transcript_text,
      segments: session.transcript_segments as any,
      patientContext,
      visitType: body.visit_type,
    });

    const guardrails = runAllGuardrails(result.draft, session.transcript_segments as any);
    const blockingFindings = guardrails.filter((f) => f.severity === 'block');

    // Persist draft via service role (RLS blocks client inserts)
    const lowConfCount = countLowConfidenceSections(result.draft, 0.7);
    const allFlags = [...new Set([...result.draft.guardrail_flags, ...guardrails.map((g) => g.type)])];

    const { createServiceClient } = await import('@/lib/supabase/server');
    const admin = createServiceClient();
    const { data: draft, error: draftErr } = await admin
      .from('scribe_drafts')
      .insert({
        session_id: session.id,
        organization_id: session.organization_id,
        patient_id: session.patient_id,
        llm: result.llm,
        model_version: result.model_version,
        prompt_version: result.prompt_version,
        chief_complaint: result.draft.chief_complaint,
        subjective: result.draft.subjective,
        objective: result.draft.objective,
        assessment: result.draft.assessment,
        plan: result.draft.plan,
        overall_confidence: result.draft.overall_confidence,
        low_confidence_section_count: lowConfCount,
        guardrail_flags: allFlags,
        input_tokens: result.input_tokens,
        output_tokens: result.output_tokens,
        cost_cents: result.cost_cents,
        generation_latency_ms: result.latency_ms,
      })
      .select('id')
      .single();

    if (draftErr || !draft) {
      console.error('[scribe generate] draft insert failed', draftErr);
      await supabase
        .from('scribe_sessions')
        .update({ status: 'generation_failed' })
        .eq('id', session.id);
      return NextResponse.json({ error: 'Could not persist draft' }, { status: 500 });
    }

    await supabase.from('scribe_sessions').update({ status: 'ready' }).eq('id', session.id);

    await logAudit({
      organizationId: session.organization_id,
      userId: user.id,
      action: 'create',
      resourceType: 'scribe_draft',
      resourceId: draft.id,
      patientId: session.patient_id,
      metadata: {
        llm: result.llm,
        cost_cents: result.cost_cents,
        latency_ms: result.latency_ms,
        confidence: result.draft.overall_confidence,
        guardrail_blocks: blockingFindings.length,
      },
    });

    return NextResponse.json({
      ok: true,
      draft_id: draft.id,
      llm: result.llm,
      overall_confidence: result.draft.overall_confidence,
      low_confidence_sections: lowConfCount,
      guardrail_findings: guardrails,
      cost_cents: result.cost_cents,
      latency_ms: result.latency_ms,
    });
  } catch (err) {
    const msg = (err as Error).message;
    console.error('[scribe generate] failed', msg);
    await supabase
      .from('scribe_sessions')
      .update({ status: 'generation_failed' })
      .eq('id', session.id);
    return NextResponse.json({ error: 'Generation failed', details: msg }, { status: 500 });
  }
}
