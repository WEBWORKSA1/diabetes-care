/**
 * CGM pattern detection
 *
 * Detects clinically-significant patterns in glucose data:
 *   - Nocturnal hypoglycemia (12am-6am, glucose <70)
 *   - Dawn phenomenon (3am-8am rise >20 mg/dL)
 *   - Postprandial spikes (>180 within 2hr of typical meal times)
 *   - Hypoglycemia unawareness (frequent <54 without preceding warning)
 *   - High variability (CV >36%)
 *
 * Severity scoring:
 *   - mild: 1-2 occurrences in period
 *   - moderate: 3-5 occurrences
 *   - severe: 6+ occurrences
 */

import type { GlucoseReading, GlucoseThresholds } from './glucose-stats';
import { DEFAULT_THRESHOLDS, computeGlucoseStats } from './glucose-stats';

export type PatternType = 'nocturnal_hypo' | 'dawn_phenomenon' | 'postprandial_spike' | 'hypo_unawareness' | 'high_variability';
export type Severity = 'mild' | 'moderate' | 'severe';

export interface DetectedPattern {
  pattern_type: PatternType;
  severity: Severity;
  details: Record<string, any>;
  description: string;
}

const MEAL_WINDOWS = [
  { name: 'breakfast', startHour: 7, endHour: 10 },
  { name: 'lunch', startHour: 12, endHour: 15 },
  { name: 'dinner', startHour: 18, endHour: 21 },
];

function severityFromCount(count: number): Severity {
  if (count >= 6) return 'severe';
  if (count >= 3) return 'moderate';
  return 'mild';
}

/**
 * Detect nocturnal hypoglycemia (any reading <low_threshold between midnight and 6am).
 * Each cluster of consecutive low readings counts as one episode.
 */
function detectNocturnalHypo(
  readings: GlucoseReading[],
  thresholds: GlucoseThresholds
): DetectedPattern | null {
  let episodeCount = 0;
  let criticalCount = 0;
  let inEpisode = false;
  let earliestEpisode: string | null = null;

  // Sort chronologically
  const sorted = [...readings].sort((a, b) =>
    new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
  );

  for (const r of sorted) {
    const dt = new Date(r.recorded_at);
    const hour = dt.getHours();
    if (hour >= 0 && hour < 6) {
      const value = Number(r.glucose_mg_dl);
      if (value < thresholds.low_threshold) {
        if (!inEpisode) {
          episodeCount++;
          if (!earliestEpisode) earliestEpisode = r.recorded_at;
          inEpisode = true;
        }
        if (value < thresholds.critical_low_threshold) criticalCount++;
      } else {
        inEpisode = false;
      }
    } else {
      inEpisode = false;
    }
  }

  if (episodeCount === 0) return null;

  const severity: Severity =
    criticalCount > 0 ? 'severe' :
    episodeCount >= 4 ? 'severe' :
    episodeCount >= 2 ? 'moderate' : 'mild';

  return {
    pattern_type: 'nocturnal_hypo',
    severity,
    details: {
      episode_count: episodeCount,
      critical_episodes: criticalCount,
      window: '00:00–06:00',
      earliest_episode: earliestEpisode,
    },
    description: `${episodeCount} nocturnal hypoglycemic episode${episodeCount === 1 ? '' : 's'} detected (12am–6am)${criticalCount > 0 ? `, ${criticalCount} critical (<${thresholds.critical_low_threshold})` : ''}`,
  };
}

/**
 * Detect dawn phenomenon: a sustained glucose rise >20 mg/dL from 3am to 8am,
 * on >=30% of days in the period.
 */
function detectDawnPhenomenon(readings: GlucoseReading[]): DetectedPattern | null {
  // Group readings by day
  const byDay: Record<string, GlucoseReading[]> = {};
  for (const r of readings) {
    const day = r.recorded_at.slice(0, 10);
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push(r);
  }

  const days = Object.keys(byDay);
  if (days.length < 3) return null;

  let dawnDays = 0;
  let maxRise = 0;
  let avgRise = 0;

  for (const day of days) {
    const dayReadings = byDay[day];
    const dawn3am = dayReadings.find((r) => {
      const h = new Date(r.recorded_at).getHours();
      return h >= 3 && h < 4;
    });
    const dawn8am = dayReadings.find((r) => {
      const h = new Date(r.recorded_at).getHours();
      return h >= 7 && h < 9;
    });
    if (dawn3am && dawn8am) {
      const rise = Number(dawn8am.glucose_mg_dl) - Number(dawn3am.glucose_mg_dl);
      if (rise > 20) {
        dawnDays++;
        avgRise += rise;
        if (rise > maxRise) maxRise = rise;
      }
    }
  }

  const dawnRate = dawnDays / days.length;
  if (dawnRate < 0.3 || dawnDays === 0) return null;

  avgRise = Math.round(avgRise / dawnDays);

  const severity: Severity =
    dawnRate >= 0.7 ? 'severe' :
    dawnRate >= 0.5 ? 'moderate' : 'mild';

  return {
    pattern_type: 'dawn_phenomenon',
    severity,
    details: {
      affected_days: dawnDays,
      total_days: days.length,
      rate: Math.round(dawnRate * 100),
      avg_rise_mg_dl: avgRise,
      max_rise_mg_dl: maxRise,
    },
    description: `Dawn phenomenon on ${dawnDays}/${days.length} days (${Math.round(dawnRate * 100)}%), avg rise ${avgRise} mg/dL from 3am–8am`,
  };
}

/**
 * Detect postprandial spikes: glucose >180 within 1-3hr of typical meal windows.
 */
function detectPostprandialSpikes(
  readings: GlucoseReading[],
  thresholds: GlucoseThresholds
): DetectedPattern | null {
  let breakfastSpikes = 0;
  let lunchSpikes = 0;
  let dinnerSpikes = 0;
  let totalSpikes = 0;
  let peakValue = 0;

  for (const r of readings) {
    const hour = new Date(r.recorded_at).getHours();
    const v = Number(r.glucose_mg_dl);

    if (v > thresholds.target_high) {
      for (const win of MEAL_WINDOWS) {
        // Window for postprandial detection: 1hr after meal start to 3hr after meal start
        if (hour >= win.startHour + 1 && hour <= win.startHour + 3) {
          if (win.name === 'breakfast') breakfastSpikes++;
          else if (win.name === 'lunch') lunchSpikes++;
          else if (win.name === 'dinner') dinnerSpikes++;
          totalSpikes++;
          if (v > peakValue) peakValue = v;
          break;
        }
      }
    }
  }

  if (totalSpikes < 3) return null;

  return {
    pattern_type: 'postprandial_spike',
    severity: severityFromCount(Math.floor(totalSpikes / 3)), // normalize by # meal windows
    details: {
      breakfast_spikes: breakfastSpikes,
      lunch_spikes: lunchSpikes,
      dinner_spikes: dinnerSpikes,
      total_spikes: totalSpikes,
      peak_value: peakValue,
    },
    description: `${totalSpikes} postprandial spikes >${thresholds.target_high} mg/dL (breakfast ${breakfastSpikes}, lunch ${lunchSpikes}, dinner ${dinnerSpikes}), peak ${peakValue}`,
  };
}

/**
 * Detect hypoglycemia unawareness: critical lows (<54) with no preceding mild low (<70) warning.
 */
function detectHypoUnawareness(
  readings: GlucoseReading[],
  thresholds: GlucoseThresholds
): DetectedPattern | null {
  const sorted = [...readings].sort((a, b) =>
    new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
  );

  let unawareEpisodes = 0;

  for (let i = 0; i < sorted.length; i++) {
    const v = Number(sorted[i].glucose_mg_dl);
    if (v < thresholds.critical_low_threshold) {
      // Look back 30 min for a warning reading
      const time = new Date(sorted[i].recorded_at).getTime();
      let hadWarning = false;
      for (let j = i - 1; j >= 0; j--) {
        const prevTime = new Date(sorted[j].recorded_at).getTime();
        const minutesBack = (time - prevTime) / (1000 * 60);
        if (minutesBack > 30) break;
        const prevV = Number(sorted[j].glucose_mg_dl);
        if (prevV >= thresholds.critical_low_threshold && prevV < thresholds.low_threshold) {
          hadWarning = true;
          break;
        }
      }
      if (!hadWarning) unawareEpisodes++;
    }
  }

  if (unawareEpisodes === 0) return null;

  return {
    pattern_type: 'hypo_unawareness',
    severity: severityFromCount(unawareEpisodes),
    details: { unaware_episodes: unawareEpisodes },
    description: `${unawareEpisodes} critical hypoglycemic episode${unawareEpisodes === 1 ? '' : 's'} without preceding warning reading — possible hypoglycemia unawareness`,
  };
}

/**
 * High variability: CV >36% per ATTD targets
 */
function detectHighVariability(readings: GlucoseReading[]): DetectedPattern | null {
  const stats = computeGlucoseStats(readings, DEFAULT_THRESHOLDS);
  if (stats.cv <= 36 || stats.count < 100) return null;

  const severity: Severity =
    stats.cv > 50 ? 'severe' :
    stats.cv > 42 ? 'moderate' : 'mild';

  return {
    pattern_type: 'high_variability',
    severity,
    details: { cv_percent: stats.cv, target: 36, mean: stats.mean, sd: stats.sd },
    description: `Glucose variability CV ${stats.cv}% (target <36%) — high glycemic instability`,
  };
}

/**
 * Run all pattern detectors on a set of readings.
 */
export function detectAllPatterns(
  readings: GlucoseReading[],
  thresholds: GlucoseThresholds = DEFAULT_THRESHOLDS
): DetectedPattern[] {
  if (readings.length < 50) return []; // need sufficient data
  const patterns: DetectedPattern[] = [];

  const detectors = [
    () => detectNocturnalHypo(readings, thresholds),
    () => detectDawnPhenomenon(readings),
    () => detectPostprandialSpikes(readings, thresholds),
    () => detectHypoUnawareness(readings, thresholds),
    () => detectHighVariability(readings),
  ];

  for (const detect of detectors) {
    const result = detect();
    if (result) patterns.push(result);
  }

  return patterns;
}

/**
 * Human-readable label for pattern types.
 */
export function patternLabel(type: PatternType): string {
  const map: Record<PatternType, string> = {
    nocturnal_hypo: 'Nocturnal hypoglycemia',
    dawn_phenomenon: 'Dawn phenomenon',
    postprandial_spike: 'Postprandial spikes',
    hypo_unawareness: 'Hypoglycemia unawareness',
    high_variability: 'High glycemic variability',
  };
  return map[type] ?? type;
}
