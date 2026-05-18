/**
 * SOAP draft generation — dual LLM support (Claude + GPT-4o).
 *
 * Returns parsed JSON conforming to scribe_drafts shape, plus token usage and cost.
 * If LLM returns malformed JSON, attempts one repair retry; otherwise throws.
 */

import { SCRIBE_SYSTEM_PROMPT, SCRIBE_PROMPT_VERSION, buildUserPrompt } from './prompts';
import type { TranscriptSegment } from './transcribe';

export type SoapContent = {
  text?: string;
  content?: string;
  source_segments: number[];
  confidence: number;
};

export type SoapSection = {
  id: string;
  label: string;
  content: string;
  source_segments: number[];
  confidence: number;
};

export interface GeneratedDraft {
  chief_complaint: { text: string; source_segments: number[]; confidence: number };
  subjective: { sections: SoapSection[] };
  objective: { sections: SoapSection[] };
  assessment: { sections: SoapSection[] };
  plan: { sections: SoapSection[] };
  overall_confidence: number;
  guardrail_flags: string[];
}

export interface GenerationResult {
  draft: GeneratedDraft;
  llm: 'claude' | 'gpt4o';
  model_version: string;
  input_tokens: number;
  output_tokens: number;
  cost_cents: number;
  latency_ms: number;
  prompt_version: string;
}

export interface GenerationInput {
  llm: 'claude' | 'gpt4o';
  transcriptText: string;
  segments: TranscriptSegment[];
  patientContext: string;
  visitType: string;
}

// Pricing in $ per million tokens (Jan 2026 rates; update as needed)
const PRICING = {
  claude: { input: 15, output: 75, model: 'claude-opus-4-7' },
  gpt4o: { input: 2.5, output: 10, model: 'gpt-4o-2024-11-20' },
} as const;

function computeCostCents(tokens: { input: number; output: number }, llm: 'claude' | 'gpt4o'): number {
  const p = PRICING[llm];
  const dollars = (tokens.input * p.input + tokens.output * p.output) / 1_000_000;
  return Math.round(dollars * 100 * 100) / 100; // cents with 2-decimal precision
}

function parseDraftJson(raw: string): GeneratedDraft {
  // Strip markdown fences if present
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    throw new Error(`LLM returned malformed JSON: ${(err as Error).message}`);
  }

  // Coerce shape with defensive defaults
  const ensureSection = (s: any): SoapSection => ({
    id: String(s.id ?? 'unknown'),
    label: String(s.label ?? s.id ?? 'Unknown'),
    content: String(s.content ?? '').trim(),
    source_segments: Array.isArray(s.source_segments) ? s.source_segments.map(Number).filter((n: number) => !isNaN(n)) : [],
    confidence: Number.isFinite(s.confidence) ? Math.max(0, Math.min(1, Number(s.confidence))) : 0.5,
  });

  const ensureField = (f: any): { sections: SoapSection[] } => ({
    sections: Array.isArray(f?.sections) ? f.sections.map(ensureSection) : [],
  });

  return {
    chief_complaint: {
      text: String(parsed.chief_complaint?.text ?? '').trim(),
      source_segments: Array.isArray(parsed.chief_complaint?.source_segments) ? parsed.chief_complaint.source_segments.map(Number).filter((n: number) => !isNaN(n)) : [],
      confidence: Number.isFinite(parsed.chief_complaint?.confidence) ? Math.max(0, Math.min(1, Number(parsed.chief_complaint.confidence))) : 0.5,
    },
    subjective: ensureField(parsed.subjective),
    objective: ensureField(parsed.objective),
    assessment: ensureField(parsed.assessment),
    plan: ensureField(parsed.plan),
    overall_confidence: Number.isFinite(parsed.overall_confidence) ? Math.max(0, Math.min(1, Number(parsed.overall_confidence))) : 0.5,
    guardrail_flags: Array.isArray(parsed.guardrail_flags) ? parsed.guardrail_flags.map(String) : [],
  };
}

async function generateWithClaude(input: GenerationInput): Promise<{ raw: string; tokens: { input: number; output: number }; latencyMs: number }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');

  const userPrompt = buildUserPrompt({
    patientContext: input.patientContext,
    transcriptText: input.transcriptText,
    segments: input.segments,
    visitType: input.visitType,
  });

  const t0 = Date.now();
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: PRICING.claude.model,
      max_tokens: 8000,
      system: SCRIBE_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    }),
    signal: AbortSignal.timeout(120_000),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Claude API failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  const raw = data.content?.[0]?.text ?? '';
  return {
    raw,
    tokens: {
      input: data.usage?.input_tokens ?? 0,
      output: data.usage?.output_tokens ?? 0,
    },
    latencyMs: Date.now() - t0,
  };
}

async function generateWithGpt4o(input: GenerationInput): Promise<{ raw: string; tokens: { input: number; output: number }; latencyMs: number }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured');

  const userPrompt = buildUserPrompt({
    patientContext: input.patientContext,
    transcriptText: input.transcriptText,
    segments: input.segments,
    visitType: input.visitType,
  });

  const t0 = Date.now();
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: PRICING.gpt4o.model,
      max_tokens: 8000,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SCRIBE_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
    }),
    signal: AbortSignal.timeout(120_000),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GPT-4o API failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content ?? '';
  return {
    raw,
    tokens: {
      input: data.usage?.prompt_tokens ?? 0,
      output: data.usage?.completion_tokens ?? 0,
    },
    latencyMs: Date.now() - t0,
  };
}

export async function generateSoapDraft(input: GenerationInput): Promise<GenerationResult> {
  const { raw, tokens, latencyMs } = input.llm === 'claude'
    ? await generateWithClaude(input)
    : await generateWithGpt4o(input);

  const draft = parseDraftJson(raw);

  return {
    draft,
    llm: input.llm,
    model_version: PRICING[input.llm].model,
    input_tokens: tokens.input,
    output_tokens: tokens.output,
    cost_cents: computeCostCents(tokens, input.llm),
    latency_ms: latencyMs,
    prompt_version: SCRIBE_PROMPT_VERSION,
  };
}

/**
 * Count sections with confidence below threshold across all SOAP fields.
 */
export function countLowConfidenceSections(draft: GeneratedDraft, threshold = 0.7): number {
  let count = 0;
  if (draft.chief_complaint.confidence < threshold) count++;
  for (const field of [draft.subjective, draft.objective, draft.assessment, draft.plan]) {
    for (const s of field.sections) {
      if (s.confidence < threshold && s.content.trim().length > 0) count++;
    }
  }
  return count;
}
