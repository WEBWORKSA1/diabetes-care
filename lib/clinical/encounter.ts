/**
 * Encounter helpers — compilation, status checks, immutability guards.
 */

export type SoapSection = { id: string; label: string; content?: string; prompt?: string };
export type SoapField = { sections: SoapSection[] };

export interface EncounterSnapshot {
  chief_complaint: string | null;
  subjective: SoapField;
  objective: SoapField;
  assessment: SoapField;
  plan: SoapField;
  vitals: Record<string, number | string | null>;
}

export function compileEncounterToText(enc: EncounterSnapshot): string {
  const parts: string[] = [];

  if (enc.chief_complaint) {
    parts.push(`CHIEF COMPLAINT: ${enc.chief_complaint}`);
    parts.push('');
  }

  const renderSection = (label: string, field: SoapField | null | undefined) => {
    if (!field?.sections?.length) return;
    parts.push(label.toUpperCase());
    for (const s of field.sections) {
      if (s.content?.trim()) {
        parts.push(`  ${s.label}: ${s.content.trim()}`);
      }
    }
    parts.push('');
  };

  renderSection('Subjective', enc.subjective);
  renderSection('Objective', enc.objective);

  if (enc.vitals && Object.keys(enc.vitals).length > 0) {
    const v = enc.vitals;
    const vitalLine = [
      v.bp_sys && v.bp_dia ? `BP ${v.bp_sys}/${v.bp_dia}` : null,
      v.hr ? `HR ${v.hr}` : null,
      v.weight_kg ? `Wt ${v.weight_kg}kg` : null,
      v.height_cm ? `Ht ${v.height_cm}cm` : null,
      v.bmi ? `BMI ${v.bmi}` : null,
      v.temp ? `Temp ${v.temp}` : null,
    ].filter(Boolean).join(' · ');
    if (vitalLine) {
      parts.push(`  Vitals: ${vitalLine}`);
      parts.push('');
    }
  }

  renderSection('Assessment', enc.assessment);
  renderSection('Plan', enc.plan);

  return parts.join('\n').trim();
}

export function calculateBMI(weightKg: number | null | undefined, heightCm: number | null | undefined): number | null {
  if (!weightKg || !heightCm || weightKg <= 0 || heightCm <= 0) return null;
  const heightM = heightCm / 100;
  return Math.round((weightKg / (heightM * heightM)) * 10) / 10;
}

export function isEncounterEditable(enc: { status: string; signed_at: string | null; locked_at: string | null; deleted_at: string | null }): boolean {
  if (enc.deleted_at) return false;
  if (enc.locked_at) return false;
  if (enc.signed_at) return false;
  if (enc.status === 'signed' || enc.status === 'amended') return false;
  return true;
}

export const DIABETES_LABS = [
  { name: 'a1c', label: 'A1C', loinc: '4548-4', unit: '%', refLow: 4.0, refHigh: 5.6 },
  { name: 'fasting_glucose', label: 'Fasting glucose', loinc: '1558-6', unit: 'mg/dL', refLow: 70, refHigh: 99 },
  { name: 'random_glucose', label: 'Random glucose', loinc: '2345-7', unit: 'mg/dL', refLow: 70, refHigh: 139 },
  { name: 'ldl', label: 'LDL cholesterol', loinc: '13457-7', unit: 'mg/dL', refLow: 0, refHigh: 100 },
  { name: 'hdl', label: 'HDL cholesterol', loinc: '2085-9', unit: 'mg/dL', refLow: 40, refHigh: 200 },
  { name: 'triglycerides', label: 'Triglycerides', loinc: '2571-8', unit: 'mg/dL', refLow: 0, refHigh: 150 },
  { name: 'egfr', label: 'eGFR', loinc: '69405-9', unit: 'mL/min/1.73m²', refLow: 60, refHigh: 200 },
  { name: 'urine_acr', label: 'Urine ACR', loinc: '14959-1', unit: 'mg/g', refLow: 0, refHigh: 30 },
  { name: 'tsh', label: 'TSH', loinc: '3016-3', unit: 'mIU/L', refLow: 0.4, refHigh: 4.0 },
  { name: 'c_peptide', label: 'C-peptide', loinc: '1986-9', unit: 'ng/mL', refLow: 0.5, refHigh: 3.0 },
  { name: 'gad65_ab', label: 'GAD-65 antibodies', loinc: '50409-9', unit: 'IU/mL', refLow: 0, refHigh: 5 },
] as const;

export type DiabetesLabName = typeof DIABETES_LABS[number]['name'];
