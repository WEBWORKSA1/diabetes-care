/**
 * Reporting queries.
 *
 * Pulled out of API routes so they're reusable for CSV export and PDF.
 * Each function returns rows scoped to the caller's organization (via RLS).
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export type ReportRange = '30d' | '90d' | '12m' | 'ytd';

export function rangeBounds(range: ReportRange): { start: Date; end: Date } {
  const end = new Date();
  const start = new Date();
  if (range === '30d') start.setDate(start.getDate() - 30);
  else if (range === '90d') start.setDate(start.getDate() - 90);
  else if (range === 'ytd') { start.setMonth(0); start.setDate(1); start.setHours(0, 0, 0, 0); }
  else start.setFullYear(start.getFullYear() - 1);
  return { start, end };
}

// ---------- Visit volume ----------

export interface VisitVolumeRow {
  week_start: string;
  completed: number;
  no_show: number;
  cancelled: number;
  other: number;
  total: number;
}

export async function visitVolumeWeekly(supabase: SupabaseClient, range: ReportRange): Promise<VisitVolumeRow[]> {
  const { start } = rangeBounds(range);
  const { data } = await supabase
    .from('v_visit_volume_weekly')
    .select('*')
    .gte('week_start', start.toISOString().slice(0, 10))
    .order('week_start', { ascending: true });
  return (data ?? []) as VisitVolumeRow[];
}

export interface VisitByProviderRow {
  provider_id: string;
  provider_name: string;
  completed: number;
  no_show: number;
  cancelled: number;
  total: number;
  no_show_rate_pct: number | null;
}

export async function visitVolumeByProvider(supabase: SupabaseClient): Promise<VisitByProviderRow[]> {
  const { data } = await supabase
    .from('v_visit_volume_by_provider')
    .select('*')
    .order('completed', { ascending: false });
  return (data ?? []) as VisitByProviderRow[];
}

// ---------- A1C population ----------

export interface A1cPopulationRow {
  patients_with_a1c: number;
  band_normal: number;
  band_at_goal: number;
  band_borderline: number;
  band_high: number;
  band_very_high: number;
  mean_a1c: number | null;
  median_a1c: number | null;
}

export async function a1cPopulation(supabase: SupabaseClient): Promise<A1cPopulationRow | null> {
  const { data } = await supabase
    .from('v_a1c_population_bands')
    .select('*')
    .maybeSingle();
  return data as A1cPopulationRow | null;
}

export interface A1cTrendPoint {
  month_start: string;
  mean_a1c: number;
  median_a1c: number;
  sample_size: number;
}

/**
 * Trend: monthly mean A1C of all measurements (not just latest-per-patient).
 * Useful for "is the practice's population improving over time?"
 */
export async function a1cTrendMonthly(supabase: SupabaseClient, months = 12): Promise<A1cTrendPoint[]> {
  const start = new Date();
  start.setMonth(start.getMonth() - months);
  start.setDate(1);
  start.setHours(0, 0, 0, 0);

  const { data } = await supabase
    .from('lab_values')
    .select('value, collected_at')
    .eq('test_name', 'a1c')
    .is('deleted_at', null)
    .gte('collected_at', start.toISOString())
    .order('collected_at', { ascending: true });

  if (!data || data.length === 0) return [];

  // Bucket by month in app code (avoids needing another view)
  const buckets = new Map<string, number[]>();
  for (const row of data) {
    const d = new Date(row.collected_at as string);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(Number(row.value));
  }

  const points: A1cTrendPoint[] = [];
  const sortedKeys = Array.from(buckets.keys()).sort();
  for (const key of sortedKeys) {
    const vals = buckets.get(key)!.sort((a, b) => a - b);
    const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
    const median = vals[Math.floor(vals.length / 2)];
    points.push({
      month_start: key,
      mean_a1c: Math.round(mean * 100) / 100,
      median_a1c: Math.round(median * 100) / 100,
      sample_size: vals.length,
    });
  }
  return points;
}

// ---------- CGM engagement ----------

export interface CgmEngagementRow {
  total_patients: number;
  patients_with_cgm: number;
  syncing_24h: number;
  syncing_7d: number;
  stale_connections: number;
}

export async function cgmEngagement(supabase: SupabaseClient): Promise<CgmEngagementRow | null> {
  const { data } = await supabase.from('v_cgm_engagement').select('*').maybeSingle();
  return data as CgmEngagementRow | null;
}

// ---------- Lab gaps ----------

export interface LabGapA1cRow {
  patient_id: string;
  first_name: string;
  last_name: string;
  mrn: string;
  diabetes_type: string;
  last_a1c: number | null;
  last_a1c_date: string | null;
  last_a1c_band: string | null;
  gap_status: 'never' | 'overdue_high_risk' | 'overdue' | 'current';
  days_since_last: number | null;
  primary_provider_id: string | null;
}

export async function labGapA1c(supabase: SupabaseClient): Promise<LabGapA1cRow[]> {
  const { data } = await supabase
    .from('v_lab_gap_a1c')
    .select('*')
    .in('gap_status', ['never', 'overdue_high_risk', 'overdue'])
    .order('gap_status', { ascending: true })
    .order('days_since_last', { ascending: false })
    .limit(500);
  return (data ?? []) as LabGapA1cRow[];
}

export interface LabGapKidneyRow {
  patient_id: string;
  first_name: string;
  last_name: string;
  mrn: string;
  last_egfr_date: string | null;
  last_acr_date: string | null;
  egfr_overdue: boolean;
  acr_overdue: boolean;
}

export async function labGapKidney(supabase: SupabaseClient): Promise<LabGapKidneyRow[]> {
  const { data } = await supabase
    .from('v_lab_gap_kidney')
    .select('*')
    .or('egfr_overdue.eq.true,acr_overdue.eq.true')
    .order('last_egfr_date', { ascending: true, nullsFirst: true })
    .limit(500);
  return (data ?? []) as LabGapKidneyRow[];
}

// ---------- Revenue proxy ----------

export interface RevenueMonthlyRow {
  month_start: string;
  completed_visits: number;
  estimated_revenue_usd: number;
}

export async function revenueMonthly(supabase: SupabaseClient): Promise<RevenueMonthlyRow[]> {
  const { data } = await supabase
    .from('v_revenue_proxy_monthly')
    .select('*')
    .order('month_start', { ascending: true });
  return (data ?? []) as RevenueMonthlyRow[];
}

// ---------- CSV helpers ----------

export function rowsToCSV(rows: any[], headers?: string[]): string {
  if (rows.length === 0 && !headers) return '';
  const cols = headers ?? Object.keys(rows[0] ?? {});
  const escape = (v: any) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [cols.join(',')];
  for (const r of rows) lines.push(cols.map((c) => escape(r[c])).join(','));
  return lines.join('\n');
}
