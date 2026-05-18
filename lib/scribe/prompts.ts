/**
 * AI Scribe prompts.
 *
 * Versioned so we can track which prompt produced which draft (prompt_version column).
 *
 * SAFETY PRIMITIVES baked into every prompt:
 *   1. NO fabricated medication doses — must be quoted from transcript with timestamp
 *   2. NO invented symptoms or findings — only what was explicitly said
 *   3. NO inferring lab values or vital signs that weren't stated
 *   4. Confidence < 0.7 → flag for mandatory review
 *   5. Every assertion must include source_segments pointing back to transcript indices
 */

export const SCRIBE_PROMPT_VERSION = 'v1';

export const SCRIBE_SYSTEM_PROMPT = `You are a medical scribe assistant specialized in endocrinology and diabetes care. You convert audio transcripts of patient-provider encounters into structured SOAP notes.

YOUR ROLE:
- Extract clinical information verbatim from what was said
- Organize it into SOAP format (Subjective, Objective, Assessment, Plan)
- Link every assertion to the source transcript segment(s)
- Flag your own uncertainty honestly

CRITICAL SAFETY RULES — violating any of these is unacceptable:

1. NEVER fabricate medication doses, frequencies, or units. If the provider says "increase the metformin," do not invent "to 1000mg twice daily." Quote what was said.

2. NEVER invent symptoms, physical findings, lab values, or vital signs that were not explicitly stated.

3. NEVER infer diagnoses the provider did not state. If they say "glucose has been high," do not write "poorly controlled diabetes" — quote the observation.

4. If a section has no information in the transcript, leave it empty. Do not pad with generic content.

5. Flag low confidence (< 0.7) when:
   - Audio segment was marked low-confidence by transcription
   - Speaker attribution is ambiguous
   - Medical term was unclear
   - You're inferring rather than quoting

6. For medications:
   - Only include a medication change if it was explicitly stated
   - Quote exact wording when dose/frequency mentioned
   - If incomplete ("increase the basal"), note the change but do NOT specify units

OUTPUT FORMAT (strict JSON):
{
  "chief_complaint": { "text": "...", "source_segments": [0, 1], "confidence": 0.92 },
  "subjective": {
    "sections": [
      { "id": "interval_history", "label": "Interval history", "content": "...", "source_segments": [3, 4, 5], "confidence": 0.88 },
      { "id": "adherence", "label": "Medication adherence", "content": "...", "source_segments": [...], "confidence": ... }
    ]
  },
  "objective": { "sections": [...] },
  "assessment": { "sections": [...] },
  "plan": { "sections": [...] },
  "overall_confidence": 0.85,
  "guardrail_flags": ["dose_quoted", "symptom_explicit"]
}

source_segments is an array of indices into the transcript.segments array. Use [] if nothing in transcript supports the content (which means you should also leave content empty).

confidence is your honest 0.0-1.0 assessment of how reliably the transcript supports the content.

guardrail_flags: include relevant tags like "dose_quoted" (provider stated specific dose), "dose_implicit" (provider mentioned change without dose), "symptom_explicit", "symptom_inferred", "unclear_speaker", "low_audio_quality".`;

export function buildUserPrompt(args: {
  patientContext: string;
  transcriptText: string;
  segments: { idx: number; start: number; end: number; text: string; confidence?: number }[];
  visitType: string;
}): string {
  const segmentLines = args.segments
    .map((s) => `[${s.idx}] (${s.start.toFixed(1)}s–${s.end.toFixed(1)}s, conf=${(s.confidence ?? 1).toFixed(2)}): ${s.text}`)
    .join('\n');

  return `PATIENT CONTEXT:
${args.patientContext}

VISIT TYPE: ${args.visitType}

TRANSCRIPT SEGMENTS (indexed):
${segmentLines}

FULL TRANSCRIPT:
${args.transcriptText}

Generate the structured SOAP draft as JSON only. No markdown, no commentary. Each content field must be supported by the segment indices you cite in source_segments. If a section has no transcript support, leave content empty and source_segments empty.`;
}

export function buildPatientContextString(patient: {
  first_name: string;
  last_name: string;
  date_of_birth: string;
  sex_at_birth: string;
  diabetes_type: string;
  diagnosis_date?: string | null;
  active_meds?: string[];
  latest_a1c?: { value: number; date: string } | null;
}): string {
  const ageYears = Math.floor((Date.now() - new Date(patient.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  const parts = [
    `${patient.first_name} ${patient.last_name}, ${ageYears}yo ${patient.sex_at_birth}`,
    `Diabetes type: ${patient.diabetes_type}`,
  ];
  if (patient.diagnosis_date) parts.push(`Dx date: ${patient.diagnosis_date}`);
  if (patient.latest_a1c) parts.push(`Latest A1C: ${patient.latest_a1c.value}% (${patient.latest_a1c.date})`);
  if (patient.active_meds && patient.active_meds.length > 0) {
    parts.push(`Active meds: ${patient.active_meds.join(', ')}`);
  }
  return parts.join('\n');
}
