/**
 * CGM pattern detection.
 *
 * Detects clinically meaningful glucose patterns:
 *   - Nocturnal hypoglycemia (glucose < threshold between 22:00-06:00)
 *   - Postprandial spikes (glucose rise >50 mg/dL within 2hr of typical meal times)
 *   - Dawn phenomenon (sustained rise 04:00-08:00 without breakfast)
 *   - High variability (CV > threshold, default 36%)
 *   - Extended highs/lows (sustained breach >60 min)
 *   - Rapid drops/rises (>3 mg/dL/min sustained)
 */

import { CgmReading, CgmThresholds, DEFAULT_THRESHOLDS, computeCgmStats } from './analytics';

export type PatternType =
  | 'nocturnal_hypo'
  | 'urgent_low'
  | 'urgent_high'
  | 'high_variability'
  | 'postprandial_spike'
  | 'dawn_phenomenon'
  | 'extended_high'
  | 'extended_low'
  | 'rapid_drop'
  | 'rapid_rise';

export type Severity = 'info' | 'warning' | 'critical';

export interface DetectedPattern {
  type: PatternType;
  severity: Severity;
  title: string;
  description: string;
  windowStart: string;
  windowEnd: string;
  context: Record<string, number | string>;
}

export interface DetectionOptions {
  thresholds?: CgmThresholds;
  detectNocturnalHypo?: boolean;
  detectPostprandialSpike?: boolean;
  detectDawnPhenomenon?: boolean;
  detectHighVariability?: boolean;
  cvThreshold?: number;
  rangeStart: Date;
  rangeEnd: Date;
}

/**
 * Run all enabled detectors over the readings and return found patterns.
 */
export function detectPatterns(
  readings: CgmReading[],
  options: DetectionOptions
): DetectedPattern[] {
  const thresholds = options.thresholds ?? DEFAULT_THRESHOLDS;
  const patterns: DetectedPattern[] = [];

  if (readings.length < 12) return patterns; // need at least 1 hour of data

  // Sort by time ascending
  const sorted = [...readings].sort(
    (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
  );

  if (options.detectNocturnalHypo !== false) {
    patterns.push(...detectNocturnalHypoglycemia(sorted, thresholds));
  }
  if (options.detectPostprandialSpike !== false) {
    patterns.push(...detectPostprandialSpikes(sorted));
  }
  if (options.detectDawnPhenomenon !== false) {
    patterns.push(...detectDawnPhenomenon(sorted));
  }
  if (options.detectHighVariability !== false) {
    patterns.push(...detectHighVariability(sorted, options.rangeStart, options.rangeEnd, options.cvThreshold ?? 36));
  }
  patterns.push(...detectUrgentExcursions(sorted, thresholds));
  patterns.push(...detectExtendedExcursions(sorted, thresholds));
  patterns.push(...detectRapidExcursions(sorted));

  return patterns;
}

/**
 * Nocturnal hypoglycemia: glucose < targetLow between 22:00-06:00, sustained ≥15 min.
 * Critical if <54, warning if <70.
 */
function detectNocturnalHypoglycemia(
  readings: CgmReading[],
  thresholds: CgmThresholds
): DetectedPattern[] {
  const patterns: DetectedPattern[] = [];
  const nightReadings = readings.filter((r) => {
    const hour = new Date(r.recorded_at).getHours();
    return hour >= 22 || hour < 6;
  });

  let runStart: CgmReading | null = null;
  let runMin = Infinity;

  for (let i = 0; i < nightReadings.length; i++) {
    const r = nightReadings[i];
    if (r.glucose_mg_dl < thresholds.targetLow) {
      if (!runStart) runStart = r;
      if (r.glucose_mg_dl < runMin) runMin = r.glucose_mg_dl;
    } else if (runStart) {
      const durationMin =
        (new Date(nightReadings[i - 1].recorded_at).getTime() - new Date(runStart.recorded_at).getTime()) / 60000;
      if (durationMin >= 15) {
        patterns.push({
          type: 'nocturnal_hypo',
          severity: runMin < thresholds.urgentLow ? 'critical' : 'warning',
          title: `Nocturnal hypoglycemia (${runMin} mg/dL)`,
          description: `Glucose dropped to ${runMin} mg/dL overnight, sustained for ${Math.round(durationMin)} min. Consider reducing evening basal insulin or bedtime snack.`,
          windowStart: runStart.recorded_at,
          windowEnd: nightReadings[i - 1].recorded_at,
          context: { min_glucose: runMin, duration_min: Math.round(durationMin) },
        });
      }
      runStart = null;
      runMin = Infinity;
    }
  }

  return patterns;
}

/**
 * Postprandial spikes: rise of ≥50 mg/dL within 2 hours after typical meal times.
 * Meal windows: breakfast 06-10, lunch 11-14, dinner 17-21.
 */
function detectPostprandialSpikes(readings: CgmReading[]): DetectedPattern[] {
  const patterns: DetectedPattern[] = [];
  const mealWindows = [
    { name: 'breakfast', startHour: 6, endHour: 10 },
    { name: 'lunch', startHour: 11, endHour: 14 },
    { name: 'dinner', startHour: 17, endHour: 21 },
  ];

  // Group readings by day
  const byDay = new Map<string, CgmReading[]>();
  for (const r of readings) {
    const day = r.recorded_at.slice(0, 10);
    const arr = byDay.get(day) ?? [];
    arr.push(r);
    byDay.set(day, arr);
  }

  // Count spike days per meal window
  const spikesByWindow: Record<string, { count: number; maxDelta: number; lastDate: string }> = {};

  for (const [day, dayReadings] of byDay) {
    for (const win of mealWindows) {
      const inWindow = dayReadings.filter((r) => {
        const h = new Date(r.recorded_at).getHours();
        return h >= win.startHour && h <= win.endHour + 2;
      });
      if (inWindow.length < 6) continue;

      const preMealMin = Math.min(...inWindow.slice(0, 3).map((r) => r.glucose_mg_dl));
      const postMealMax = Math.max(...inWindow.map((r) => r.glucose_mg_dl));
      const delta = postMealMax - preMealMin;

      if (delta >= 50 && postMealMax > 180) {
        const key = win.name;
        const existing = spikesByWindow[key];
        if (!existing) {
          spikesByWindow[key] = { count: 1, maxDelta: delta, lastDate: day };
        } else {
          existing.count++;
          existing.maxDelta = Math.max(existing.maxDelta, delta);
          existing.lastDate = day;
        }
      }
    }
  }

  for (const [windowName, info] of Object.entries(spikesByWindow)) {
    if (info.count >= 3) {
      // Pattern: 3+ days of spikes in same meal window
      patterns.push({
        type: 'postprandial_spike',
        severity: info.maxDelta > 100 ? 'warning' : 'info',
        title: `Recurring postprandial spike after ${windowName}`,
        description: `Glucose rose by an average of ${Math.round(info.maxDelta)} mg/dL after ${windowName} on ${info.count} days. Consider pre-meal insulin timing, carb counting review, or rapid-acting dose adjustment.`,
        windowStart: `${info.lastDate}T00:00:00Z`,
        windowEnd: `${info.lastDate}T23:59:59Z`,
        context: { days_observed: info.count, max_delta_mg_dl: info.maxDelta, meal: windowName },
      });
    }
  }

  return patterns;
}

/**
 * Dawn phenomenon: glucose rises ≥30 mg/dL between 04:00-08:00 without preceding food.
 * Look for at least 3 days in the window showing this.
 */
function detectDawnPhenomenon(readings: CgmReading[]): DetectedPattern[] {
  const patterns: DetectedPattern[] = [];

  const byDay = new Map<string, CgmReading[]>();
  for (const r of readings) {
    const day = r.recorded_at.slice(0, 10);
    const arr = byDay.get(day) ?? [];
    arr.push(r);
    byDay.set(day, arr);
  }

  let dawnDays = 0;
  let totalRise = 0;
  let lastDate = '';
  for (const [day, dayReadings] of byDay) {
    const window = dayReadings.filter((r) => {
      const h = new Date(r.recorded_at).getHours();
      return h >= 4 && h < 8;
    });
    if (window.length < 6) continue;

    const earliest = window[0].glucose_mg_dl;
    const latest = window[window.length - 1].glucose_mg_dl;
    const rise = latest - earliest;
    if (rise >= 30 && earliest > 70) {
      dawnDays++;
      totalRise += rise;
      lastDate = day;
    }
  }

  if (dawnDays >= 3) {
    const avgRise = Math.round(totalRise / dawnDays);
    patterns.push({
      type: 'dawn_phenomenon',
      severity: 'info',
      title: `Dawn phenomenon detected`,
      description: `Glucose rose by an average of ${avgRise} mg/dL between 04:00-08:00 on ${dawnDays} days. Consider extended basal insulin or pump basal rate adjustment for early-morning hours.`,
      windowStart: `${lastDate}T04:00:00Z`,
      windowEnd: `${lastDate}T08:00:00Z`,
      context: { days_observed: dawnDays, avg_rise_mg_dl: avgRise },
    });
  }

  return patterns;
}

/**
 * High glucose variability: CV > threshold (default 36%) over the window.
 */
function detectHighVariability(
  readings: CgmReading[],
  start: Date,
  end: Date,
  cvThreshold: number
): DetectedPattern[] {
  if (readings.length < 100) return [];
  const stats = computeCgmStats(readings, start, end);
  if (stats.cv !== null && stats.cv > cvThreshold) {
    return [
      {
        type: 'high_variability',
        severity: stats.cv > 45 ? 'warning' : 'info',
        title: `High glucose variability (CV ${stats.cv}%)`,
        description: `Coefficient of variation is ${stats.cv}%, above the target of ${cvThreshold}%. High variability is associated with increased hypoglycemia risk. Consider basal optimization or behavioral consistency review.`,
        windowStart: start.toISOString(),
        windowEnd: end.toISOString(),
        context: { cv: stats.cv, threshold: cvThreshold },
      },
    ];
  }
  return [];
}

/**
 * Urgent low (<54) or urgent high (>250) episodes in the window.
 */
function detectUrgentExcursions(
  readings: CgmReading[],
  thresholds: CgmThresholds
): DetectedPattern[] {
  const patterns: DetectedPattern[] = [];
  const urgentLows = readings.filter((r) => r.glucose_mg_dl < thresholds.urgentLow);
  const urgentHighs = readings.filter((r) => r.glucose_mg_dl > thresholds.urgentHigh);

  if (urgentLows.length > 0) {
    const minVal = Math.min(...urgentLows.map((r) => r.glucose_mg_dl));
    patterns.push({
      type: 'urgent_low',
      severity: 'critical',
      title: `Urgent low episodes (${urgentLows.length})`,
      description: `Glucose dropped below ${thresholds.urgentLow} mg/dL on ${urgentLows.length} readings. Lowest: ${minVal} mg/dL. Immediate hypoglycemia review indicated.`,
      windowStart: urgentLows[0].recorded_at,
      windowEnd: urgentLows[urgentLows.length - 1].recorded_at,
      context: { count: urgentLows.length, min_glucose: minVal },
    });
  }

  if (urgentHighs.length > 0) {
    const maxVal = Math.max(...urgentHighs.map((r) => r.glucose_mg_dl));
    patterns.push({
      type: 'urgent_high',
      severity: 'warning',
      title: `Urgent high episodes (${urgentHighs.length})`,
      description: `Glucose exceeded ${thresholds.urgentHigh} mg/dL on ${urgentHighs.length} readings. Highest: ${maxVal} mg/dL. Consider basal/bolus intensification.`,
      windowStart: urgentHighs[0].recorded_at,
      windowEnd: urgentHighs[urgentHighs.length - 1].recorded_at,
      context: { count: urgentHighs.length, max_glucose: maxVal },
    });
  }

  return patterns;
}

/**
 * Extended excursions: glucose stayed above 180 or below 70 for >60 minutes continuously.
 */
function detectExtendedExcursions(
  readings: CgmReading[],
  thresholds: CgmThresholds
): DetectedPattern[] {
  const patterns: DetectedPattern[] = [];
  let highStart: CgmReading | null = null;
  let lowStart: CgmReading | null = null;
  const MIN_DURATION_MIN = 60;

  for (let i = 0; i < readings.length; i++) {
    const r = readings[i];
    // High runs
    if (r.glucose_mg_dl > thresholds.targetHigh) {
      if (!highStart) highStart = r;
    } else if (highStart) {
      const dur = (new Date(readings[i - 1].recorded_at).getTime() - new Date(highStart.recorded_at).getTime()) / 60000;
      if (dur >= MIN_DURATION_MIN) {
        patterns.push({
          type: 'extended_high',
          severity: 'info',
          title: `Extended hyperglycemia (${Math.round(dur)} min)`,
          description: `Glucose stayed above ${thresholds.targetHigh} mg/dL for ${Math.round(dur)} continuous minutes.`,
          windowStart: highStart.recorded_at,
          windowEnd: readings[i - 1].recorded_at,
          context: { duration_min: Math.round(dur) },
        });
      }
      highStart = null;
    }
    // Low runs
    if (r.glucose_mg_dl < thresholds.targetLow) {
      if (!lowStart) lowStart = r;
    } else if (lowStart) {
      const dur = (new Date(readings[i - 1].recorded_at).getTime() - new Date(lowStart.recorded_at).getTime()) / 60000;
      if (dur >= MIN_DURATION_MIN) {
        patterns.push({
          type: 'extended_low',
          severity: 'warning',
          title: `Extended hypoglycemia (${Math.round(dur)} min)`,
          description: `Glucose stayed below ${thresholds.targetLow} mg/dL for ${Math.round(dur)} continuous minutes.`,
          windowStart: lowStart.recorded_at,
          windowEnd: readings[i - 1].recorded_at,
          context: { duration_min: Math.round(dur) },
        });
      }
      lowStart = null;
    }
  }

  return patterns;
}

/**
 * Rapid drops/rises: ≥3 mg/dL/min sustained over ≥15 min.
 */
function detectRapidExcursions(readings: CgmReading[]): DetectedPattern[] {
  const patterns: DetectedPattern[] = [];
  for (let i = 3; i < readings.length; i++) {
    const r0 = readings[i - 3];
    const r1 = readings[i];
    const dtMin = (new Date(r1.recorded_at).getTime() - new Date(r0.recorded_at).getTime()) / 60000;
    if (dtMin < 10 || dtMin > 30) continue;
    const rate = (r1.glucose_mg_dl - r0.glucose_mg_dl) / dtMin;
    if (rate <= -3) {
      patterns.push({
        type: 'rapid_drop',
        severity: r1.glucose_mg_dl < 80 ? 'warning' : 'info',
        title: `Rapid glucose drop`,
        description: `Glucose fell at ${Math.abs(Math.round(rate * 10) / 10)} mg/dL/min from ${r0.glucose_mg_dl} to ${r1.glucose_mg_dl}.`,
        windowStart: r0.recorded_at,
        windowEnd: r1.recorded_at,
        context: { rate_mg_dl_per_min: Math.round(rate * 10) / 10 },
      });
    } else if (rate >= 3) {
      patterns.push({
        type: 'rapid_rise',
        severity: 'info',
        title: `Rapid glucose rise`,
        description: `Glucose rose at ${Math.round(rate * 10) / 10} mg/dL/min from ${r0.glucose_mg_dl} to ${r1.glucose_mg_dl}.`,
        windowStart: r0.recorded_at,
        windowEnd: r1.recorded_at,
        context: { rate_mg_dl_per_min: Math.round(rate * 10) / 10 },
      });
    }
  }
  // Dedupe: only keep one rapid event per hour
  const deduped: DetectedPattern[] = [];
  for (const p of patterns) {
    const last = deduped[deduped.length - 1];
    if (!last || new Date(p.windowStart).getTime() - new Date(last.windowEnd).getTime() > 60 * 60 * 1000) {
      deduped.push(p);
    }
  }
  return deduped.slice(0, 5); // cap to top 5
}
