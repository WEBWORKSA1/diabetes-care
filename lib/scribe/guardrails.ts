/**
 * Post-generation guardrails that scan the LLM output for hallucination risk.
 *
 * These are CATCH-NETS — the prompt itself is the first line of defense. These run
 * after the fact to flag content for provider review and reject obvious violations.
 */

import type { GeneratedDraft, SoapSection } from './llm-generators';
import type { TranscriptSegment } from './transcribe';

export interface GuardrailFinding {
  severity: 'block' | 'warn' | 'info';
  type: string;
  section: string;
  message: string;
}

// Patterns that look like fabricated medication doses
const DOSE_PATTERN = /\b\d+(?:\.\d+)?\s*(?:mg|mcg|units?|u|ml|g|iu)\b/gi;
const DOSE_WORDS = /\b(?:once|twice|three times|four times|daily|bid|tid|qid|qhs|qam|qpm|prn|weekly|monthly)\b/gi;

/**
 * For every dose mention in the draft, verify there's textual support in the cited transcript segments.
 */
export function checkDoseQuoting(
  draft: GeneratedDraft,
  segments: TranscriptSegment[]
): GuardrailFinding[] {
  const findings: GuardrailFinding[] = [];

  const checkSection = (section: SoapSection, path: string) => {
    const doses = section.content.match(DOSE_PATTERN);
    if (!doses || doses.length === 0) return;

    const supportingText = section.source_segments
      .map((idx) => segments[idx]?.text ?? '')
      .join(' ')
      .toLowerCase();

    for (const dose of doses) {
      // Normalize: extract the numeric + unit
      const match = dose.toLowerCase().match(/(\d+(?:\.\d+)?)\s*([a-z]+)/);
      if (!match) continue;
      const [, num, unit] = match;

      // Look for the number AND a similar unit in supporting text
      const numInSource = supportingText.includes(num);
      const unitInSource = supportingText.includes(unit) || supportingText.includes(unit.replace('s', ''));

      if (!numInSource || !unitInSource) {
        findings.push({
          severity: 'block',
          type: 'dose_not_in_source',
          section: path,
          message: `Dose "${dose}" appears in draft but is not found in cited transcript segments. Possible fabrication.`,
        });
      }
    }
  };

  for (const field of ['subjective', 'objective', 'assessment', 'plan'] as const) {
    for (const s of draft[field].sections) {
      checkSection(s, `${field}.${s.id}`);
    }
  }

  return findings;
}

/**
 * Sections with content but empty source_segments — unsupported content.
 */
export function checkUnsourcedContent(draft: GeneratedDraft): GuardrailFinding[] {
  const findings: GuardrailFinding[] = [];
  const check = (section: SoapSection, path: string) => {
    if (section.content.trim().length > 20 && section.source_segments.length === 0) {
      findings.push({
        severity: 'warn',
        type: 'unsourced_content',
        section: path,
        message: `Section has content but no source segments cited. Verify against audio.`,
      });
    }
  };
  for (const field of ['subjective', 'objective', 'assessment', 'plan'] as const) {
    for (const s of draft[field].sections) {
      check(s, `${field}.${s.id}`);
    }
  }
  return findings;
}

/**
 * Reference to lab values or vitals — should be supported by transcript or marked as unverified.
 */
const LAB_PATTERN = /\b(?:a1c|hba1c|glucose|ldl|hdl|triglycerides|egfr|creatinine|tsh|bp|blood pressure|heart rate|weight|bmi)\b/gi;
const NUMBER_PATTERN = /\b\d+(?:\.\d+)?\b/g;

export function checkLabValueQuoting(
  draft: GeneratedDraft,
  segments: TranscriptSegment[]
): GuardrailFinding[] {
  const findings: GuardrailFinding[] = [];

  const check = (section: SoapSection, path: string) => {
    const labs = section.content.match(LAB_PATTERN);
    const numbers = section.content.match(NUMBER_PATTERN);
    if (!labs || !numbers || numbers.length === 0) return;

    const supportingText = section.source_segments
      .map((idx) => segments[idx]?.text ?? '')
      .join(' ');

    for (const num of numbers) {
      if (!supportingText.includes(num)) {
        findings.push({
          severity: 'warn',
          type: 'lab_number_not_in_source',
          section: path,
          message: `Number "${num}" near lab/vital reference but not in cited transcript. Verify.`,
        });
      }
    }
  };

  for (const field of ['objective', 'assessment'] as const) {
    for (const s of draft[field].sections) {
      check(s, `${field}.${s.id}`);
    }
  }
  return findings;
}

/**
 * Run all guardrails.
 */
export function runAllGuardrails(
  draft: GeneratedDraft,
  segments: TranscriptSegment[]
): GuardrailFinding[] {
  return [
    ...checkDoseQuoting(draft, segments),
    ...checkUnsourcedContent(draft),
    ...checkLabValueQuoting(draft, segments),
  ];
}
