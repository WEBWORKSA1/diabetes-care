/**
 * Insulin titration calculator
 * Based on ADA Standards of Care and treat-to-target trials.
 *
 * NOT medical advice. Suggestions only. Provider verifies before applying.
 */

export type InsulinType = 'basal' | 'prandial' | 'mixed';

export interface TitrationInput {
  insulinType: InsulinType;
  currentDose: number;
  fastingGlucose?: number;
  preMealGlucose?: number;
  hypoEpisodes?: number;
  targetFasting?: number;
  targetPreMeal?: number;
  patientWeightKg?: number;
}

export interface TitrationResult {
  recommendedDose: number;
  change: number;
  rationale: string;
  warnings: string[];
  rule: string;
}

export function calculateBasalTitration(input: TitrationInput): TitrationResult {
  const warnings: string[] = [];
  const targetFasting = input.targetFasting ?? 110;
  const fbg = input.fastingGlucose;
  const hypos = input.hypoEpisodes ?? 0;
  let change = 0;
  let rationale = '';
  let rule = 'ADA basal titration';

  if (hypos > 0) {
    change = -Math.max(2, Math.round(input.currentDose * 0.1));
    rationale = `${hypos} hypoglycemic episode(s) in past 7 days. Reduce dose by 10% (minimum 2u) for safety.`;
    rule = 'Hypoglycemia rule';
  } else if (fbg === undefined) {
    rationale = 'No fasting glucose data provided. Cannot recommend titration without recent FBG values.';
    warnings.push('Insufficient data — collect 3-day FBG average before titrating.');
  } else if (fbg < 70) {
    change = -Math.round(input.currentDose * 0.2);
    rationale = `FBG ${fbg} below safe range. Reduce dose by 20%.`;
    warnings.push('FBG below 70 — confirm with CGM/SMBG. Rule out nocturnal hypoglycemia.');
    rule = 'Hypoglycemia avoidance';
  } else if (fbg < 80) {
    change = -2;
    rationale = `FBG ${fbg} below target lower bound (80). Reduce by 2u.`;
  } else if (fbg <= targetFasting) {
    change = 0;
    rationale = `FBG ${fbg} at target (${input.targetFasting ?? 80}-${targetFasting}). No change.`;
  } else if (fbg <= 130) {
    change = 1;
    rationale = `FBG ${fbg} mildly above target. Increase by 1u.`;
  } else if (fbg <= 180) {
    change = 2;
    rationale = `FBG ${fbg} above target. Increase by 2u.`;
  } else if (fbg <= 240) {
    change = 4;
    rationale = `FBG ${fbg} substantially above target. Increase by 4u.`;
    warnings.push('Consider barriers — adherence, diet, illness, steroid use.');
  } else {
    change = 4;
    rationale = `FBG ${fbg} severely elevated. Increase by 4u and consider intensification (add prandial or GLP-1).`;
    warnings.push('FBG >240 persistently suggests inadequate basal or need for prandial coverage.');
    rule = 'Intensification consideration';
  }

  const recommendedDose = Math.max(0, input.currentDose + change);

  if (recommendedDose > 200) {
    warnings.push('Total daily basal >200u — consider U-500 insulin or add GLP-1/SGLT2 rather than further increase.');
  }
  if (input.patientWeightKg && recommendedDose > input.patientWeightKg * 1.0) {
    warnings.push(`Dose exceeds 1u/kg (${input.patientWeightKg}kg). Insulin resistance vs alternative therapy assessment.`);
  }

  return { recommendedDose, change, rationale, warnings, rule };
}

export function calculatePrandialTitration(input: TitrationInput): TitrationResult {
  const warnings: string[] = [];
  const hypos = input.hypoEpisodes ?? 0;
  const pmg = input.preMealGlucose;
  let change = 0;
  let rationale = '';
  let rule = 'Prandial titration';

  if (hypos > 0) {
    change = -1;
    rationale = `Hypoglycemia in past 7 days. Reduce prandial by 1u.`;
    rule = 'Hypoglycemia rule';
  } else if (pmg === undefined) {
    rationale = 'No post-meal glucose data. Cannot titrate without 2hr post-prandial values.';
    warnings.push('Collect 3-day post-meal average before adjusting.');
  } else if (pmg < 100) {
    change = -1;
    rationale = `Post-meal ${pmg} below target. Reduce by 1u.`;
  } else if (pmg <= 180) {
    change = 0;
    rationale = `Post-meal ${pmg} at target (<180). No change.`;
  } else if (pmg <= 240) {
    change = 1;
    rationale = `Post-meal ${pmg} above target. Increase by 1u.`;
  } else {
    change = 2;
    rationale = `Post-meal ${pmg} substantially elevated. Increase by 2u.`;
    warnings.push('Consider ICR adjustment or pre-meal timing if persistent.');
  }

  return { recommendedDose: Math.max(0, input.currentDose + change), change, rationale, warnings, rule };
}

export function calculateTitration(input: TitrationInput): TitrationResult {
  switch (input.insulinType) {
    case 'basal':
      return calculateBasalTitration(input);
    case 'prandial':
      return calculatePrandialTitration(input);
    case 'mixed':
      return {
        recommendedDose: input.currentDose,
        change: 0,
        rationale: 'Mixed/premixed insulin titration is complex. Consider switching to basal/bolus regimen or consult endocrinology guidelines directly.',
        warnings: ['Premixed insulin not algorithmically titrated in this tool.'],
        rule: 'Manual review required',
      };
    default:
      return {
        recommendedDose: input.currentDose,
        change: 0,
        rationale: 'Unknown insulin type.',
        warnings: ['Specify insulin type.'],
        rule: 'Error',
      };
  }
}
