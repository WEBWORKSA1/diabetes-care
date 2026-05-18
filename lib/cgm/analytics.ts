/**
 * CGM analytics: TIR, GMI, CV, time-of-day binning.
 *
 * All glucose values are in mg/dL.
 * Reference: ADA Standards of Care + ATTD international consensus on CGM.
 */

export interface CgmReading {
  recorded_at: string;
  glucose_mg_dl: number;
  trend?: string;
}

export interface CgmStats {
  count: number;
  meanGlucose: number | null;
  stddev: number | null;
  cv: number | null; // coefficient of variation %
  gmi: number | null; // Glucose Management Indicator (estimated A1C)
  tir: { low: number; range: number; high: number; urgentLow: number; urgentHigh: number }; // %
  minGlucose: number | null;
  maxGlucose: number | null;
  rangeStart: string;
  rangeEnd: string;
  coverage: number; // 0..1, % of expected readings present
}

export interface CgmThresholds {
  targetLow: number; // default 70
  targetHigh: number; // default 180
  urgentLow: number; // default 54
  urgentHigh: number; // default 250
}

export const DEFAULT_THRESHOLDS: CgmThresholds = {
  targetLow: 70,
  targetHigh: 180,
  urgentLow: 54,
  urgentHigh: 250,
};

/**
 * Compute summary stats for a window of CGM readings.
 * Returns null fields if no readings.
 */
export function computeCgmStats(
  readings: CgmReading[],
  rangeStart: Date,
  rangeEnd: Date,
  thresholds: CgmThresholds = DEFAULT_THRESHOLDS
): CgmStats {
  const empty: CgmStats = {
    count: 0,
    meanGlucose: null,
    stddev: null,
    cv: null,
    gmi: null,
    tir: { low: 0, range: 0, high: 0, urgentLow: 0, urgentHigh: 0 },
    minGlucose: null,
    maxGlucose: null,
    rangeStart: rangeStart.toISOString(),
    rangeEnd: rangeEnd.toISOString(),
    coverage: 0,
  };

  if (readings.length === 0) return empty;

  const values = readings.map((r) => r.glucose_mg_dl);
  const sum = values.reduce((a, b) => a + b, 0);
  const mean = sum / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  const stddev = Math.sqrt(variance);
  const cv = mean > 0 ? (stddev / mean) * 100 : 0;

  // GMI = 3.31 + 0.02392 * mean_glucose_mg_dl (Bergenstal 2018)
  const gmi = 3.31 + 0.02392 * mean;

  // Time in range calculations
  let countUrgentLow = 0, countLow = 0, countRange = 0, countHigh = 0, countUrgentHigh = 0;
  for (const v of values) {
    if (v < thresholds.urgentLow) countUrgentLow++;
    else if (v < thresholds.targetLow) countLow++;
    else if (v <= thresholds.targetHigh) countRange++;
    else if (v <= thresholds.urgentHigh) countHigh++;
    else countUrgentHigh++;
  }

  const total = values.length;
  const tir = {
    urgentLow: (countUrgentLow / total) * 100,
    low: (countLow / total) * 100,
    range: (countRange / total) * 100,
    high: (countHigh / total) * 100,
    urgentHigh: (countUrgentHigh / total) * 100,
  };

  // Coverage: expected readings (1 per 5 minutes for Dexcom G6/G7)
  const windowMs = rangeEnd.getTime() - rangeStart.getTime();
  const expected = Math.floor(windowMs / (5 * 60 * 1000));
  const coverage = expected > 0 ? Math.min(1, total / expected) : 0;

  return {
    count: total,
    meanGlucose: Math.round(mean * 10) / 10,
    stddev: Math.round(stddev * 10) / 10,
    cv: Math.round(cv * 10) / 10,
    gmi: Math.round(gmi * 100) / 100,
    tir: {
      urgentLow: Math.round(tir.urgentLow * 10) / 10,
      low: Math.round(tir.low * 10) / 10,
      range: Math.round(tir.range * 10) / 10,
      high: Math.round(tir.high * 10) / 10,
      urgentHigh: Math.round(tir.urgentHigh * 10) / 10,
    },
    minGlucose: Math.min(...values),
    maxGlucose: Math.max(...values),
    rangeStart: rangeStart.toISOString(),
    rangeEnd: rangeEnd.toISOString(),
    coverage: Math.round(coverage * 100) / 100,
  };
}

/**
 * Bin readings into 24 hour-of-day buckets for AGP (Ambulatory Glucose Profile) charts.
 * Returns array of 24 buckets, each with percentiles.
 */
export interface HourBucket {
  hour: number;
  count: number;
  p10: number | null;
  p25: number | null;
  p50: number | null; // median
  p75: number | null;
  p90: number | null;
  mean: number | null;
}

export function binByHourOfDay(readings: CgmReading[]): HourBucket[] {
  const buckets: number[][] = Array.from({ length: 24 }, () => []);
  for (const r of readings) {
    const hour = new Date(r.recorded_at).getHours();
    buckets[hour].push(r.glucose_mg_dl);
  }

  function percentile(sorted: number[], p: number): number | null {
    if (sorted.length === 0) return null;
    const idx = (p / 100) * (sorted.length - 1);
    const lower = Math.floor(idx);
    const upper = Math.ceil(idx);
    if (lower === upper) return sorted[lower];
    const weight = idx - lower;
    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
  }

  return buckets.map((values, hour) => {
    if (values.length === 0) {
      return { hour, count: 0, p10: null, p25: null, p50: null, p75: null, p90: null, mean: null };
    }
    const sorted = [...values].sort((a, b) => a - b);
    const mean = sorted.reduce((a, b) => a + b, 0) / sorted.length;
    return {
      hour,
      count: values.length,
      p10: Math.round(percentile(sorted, 10)!),
      p25: Math.round(percentile(sorted, 25)!),
      p50: Math.round(percentile(sorted, 50)!),
      p75: Math.round(percentile(sorted, 75)!),
      p90: Math.round(percentile(sorted, 90)!),
      mean: Math.round(mean * 10) / 10,
    };
  });
}

/**
 * Group readings into day windows.
 */
export function groupByDay(readings: CgmReading[]): Map<string, CgmReading[]> {
  const groups = new Map<string, CgmReading[]>();
  for (const r of readings) {
    const day = r.recorded_at.slice(0, 10); // YYYY-MM-DD
    const existing = groups.get(day) ?? [];
    existing.push(r);
    groups.set(day, existing);
  }
  return groups;
}

/**
 * Helper: filter readings to a date range.
 */
export function filterByRange(
  readings: CgmReading[],
  start: Date,
  end: Date
): CgmReading[] {
  const startMs = start.getTime();
  const endMs = end.getTime();
  return readings.filter((r) => {
    const t = new Date(r.recorded_at).getTime();
    return t >= startMs && t <= endMs;
  });
}

/**
 * Daterange presets used across UI.
 */
export function rangePreset(preset: '14d' | '30d' | '90d', now: Date = new Date()): { start: Date; end: Date } {
  const end = new Date(now);
  const start = new Date(now);
  switch (preset) {
    case '14d': start.setDate(start.getDate() - 14); break;
    case '30d': start.setDate(start.getDate() - 30); break;
    case '90d': start.setDate(start.getDate() - 90); break;
  }
  return { start, end };
}
