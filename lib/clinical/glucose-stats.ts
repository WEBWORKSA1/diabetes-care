/**
 * Glucose statistics calculation
 *
 * Implements ATTD consensus targets:
 *   - TIR (Time in Range): % time 70-180 mg/dL, target >70%
 *   - TAR (Time Above Range): >180 (level 1), >250 (level 2)
 *   - TBR (Time Below Range): <70 (level 1), <54 (level 2)
 *   - GMI (Glucose Management Indicator): estimated A1C from mean glucose
 *   - CV (Coefficient of Variation): SD/mean *100, target <36%
 */

export interface GlucoseReading {
  recorded_at: string;
  glucose_mg_dl: number;
  trend?: string | null;
}

export interface GlucoseThresholds {
  target_low: number;
  target_high: number;
  low_threshold: number;
  critical_low_threshold: number;
  high_threshold: number;
  critical_high_threshold: number;
}

export const DEFAULT_THRESHOLDS: GlucoseThresholds = {
  target_low: 70,
  target_high: 180,
  low_threshold: 70,
  critical_low_threshold: 54,
  high_threshold: 180,
  critical_high_threshold: 250,
};

export interface GlucoseStats {
  count: number;
  mean: number;
  median: number;
  sd: number;
  cv: number; // coefficient of variation %
  gmi: number; // estimated A1C %
  // Time-in-range percentages
  tir: number; // 70-180
  tar_1: number; // >180 but <=250
  tar_2: number; // >250
  tbr_1: number; // <70 but >=54
  tbr_2: number; // <54
  // Sensor data quality
  expectedReadings: number;
  capturePercent: number;
  // Period bounds
  periodStart: Date;
  periodEnd: Date;
  periodDays: number;
}

/**
 * Compute glucose statistics over a period.
 * Assumes ~288 readings per day (every 5 min); capturePercent = actual / expected.
 */
export function computeGlucoseStats(
  readings: GlucoseReading[],
  thresholds: GlucoseThresholds = DEFAULT_THRESHOLDS,
  periodStart?: Date,
  periodEnd?: Date
): GlucoseStats {
  if (readings.length === 0) {
    const start = periodStart ?? new Date();
    const end = periodEnd ?? new Date();
    return {
      count: 0, mean: 0, median: 0, sd: 0, cv: 0, gmi: 0,
      tir: 0, tar_1: 0, tar_2: 0, tbr_1: 0, tbr_2: 0,
      expectedReadings: 0, capturePercent: 0,
      periodStart: start, periodEnd: end, periodDays: 0,
    };
  }

  const values = readings.map((r) => Number(r.glucose_mg_dl)).filter((v) => !Number.isNaN(v));
  const count = values.length;
  const mean = values.reduce((s, v) => s + v, 0) / count;
  const sorted = [...values].sort((a, b) => a - b);
  const median = count % 2 === 0
    ? (sorted[count / 2 - 1] + sorted[count / 2]) / 2
    : sorted[Math.floor(count / 2)];
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / count;
  const sd = Math.sqrt(variance);
  const cv = (sd / mean) * 100;
  // GMI formula (Bergenstal et al, 2018): GMI(%) = 3.31 + 0.02392 * mean_glucose(mg/dL)
  const gmi = 3.31 + 0.02392 * mean;

  // Time-in-range bucketing
  let tirCount = 0, tar1 = 0, tar2 = 0, tbr1 = 0, tbr2 = 0;
  for (const v of values) {
    if (v < thresholds.critical_low_threshold) tbr2++;
    else if (v < thresholds.target_low) tbr1++;
    else if (v <= thresholds.target_high) tirCount++;
    else if (v <= thresholds.critical_high_threshold) tar1++;
    else tar2++;
  }

  const pct = (n: number) => Math.round((n / count) * 1000) / 10;

  // Capture % vs expected (assuming Dexcom-style 5-min sampling)
  const start = periodStart ?? new Date(readings[readings.length - 1].recorded_at);
  const end = periodEnd ?? new Date(readings[0].recorded_at);
  const ms = end.getTime() - start.getTime();
  const periodDays = ms / (1000 * 60 * 60 * 24);
  const expectedReadings = Math.max(1, Math.round(periodDays * 288));
  const capturePercent = Math.min(100, Math.round((count / expectedReadings) * 1000) / 10);

  return {
    count,
    mean: Math.round(mean * 10) / 10,
    median: Math.round(median * 10) / 10,
    sd: Math.round(sd * 10) / 10,
    cv: Math.round(cv * 10) / 10,
    gmi: Math.round(gmi * 100) / 100,
    tir: pct(tirCount),
    tar_1: pct(tar1),
    tar_2: pct(tar2),
    tbr_1: pct(tbr1),
    tbr_2: pct(tbr2),
    expectedReadings,
    capturePercent,
    periodStart: start,
    periodEnd: end,
    periodDays: Math.round(periodDays * 10) / 10,
  };
}

/**
 * Classify TIR achievement per ATTD goals.
 */
export function classifyTIR(tir: number, tbr2: number): {
  label: string;
  tone: 'good' | 'borderline' | 'high' | 'critical';
} {
  if (tbr2 >= 1.0) return { label: 'Hypoglycemia-limited', tone: 'critical' };
  if (tir >= 70) return { label: 'At target (>70% TIR)', tone: 'good' };
  if (tir >= 50) return { label: 'Below target (50-70%)', tone: 'borderline' };
  if (tir >= 25) return { label: 'Poor control (25-50%)', tone: 'high' };
  return { label: 'Very poor control (<25%)', tone: 'critical' };
}

/**
 * Bucket readings by hour-of-day for AGP-style chart.
 * Returns 24 buckets with min/p10/p25/median/p75/p90/max for each hour.
 */
export interface AGPBucket {
  hour: number;
  count: number;
  p10: number;
  p25: number;
  median: number;
  p75: number;
  p90: number;
}

export function computeAGP(readings: GlucoseReading[]): AGPBucket[] {
  const byHour: Record<number, number[]> = {};
  for (let h = 0; h < 24; h++) byHour[h] = [];

  for (const r of readings) {
    const hour = new Date(r.recorded_at).getHours();
    byHour[hour].push(Number(r.glucose_mg_dl));
  }

  const percentile = (sorted: number[], p: number): number => {
    if (sorted.length === 0) return 0;
    const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
    return sorted[idx];
  };

  return Array.from({ length: 24 }, (_, h) => {
    const sorted = byHour[h].sort((a, b) => a - b);
    return {
      hour: h,
      count: sorted.length,
      p10: sorted.length > 0 ? Math.round(percentile(sorted, 10)) : 0,
      p25: sorted.length > 0 ? Math.round(percentile(sorted, 25)) : 0,
      median: sorted.length > 0 ? Math.round(percentile(sorted, 50)) : 0,
      p75: sorted.length > 0 ? Math.round(percentile(sorted, 75)) : 0,
      p90: sorted.length > 0 ? Math.round(percentile(sorted, 90)) : 0,
    };
  });
}
