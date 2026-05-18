/**
 * Lab analytics helpers — abnormal detection, trend computation, CSV export.
 */

import { DIABETES_LABS } from './encounter';

export interface LabRow {
  id: string;
  test_name: string;
  value: number | string;
  unit: string;
  reference_low: number | null;
  reference_high: number | null;
  is_abnormal: boolean | null;
  collected_at: string;
  notes?: string | null;
}

export interface LabSummary {
  test_name: string;
  label: string;
  unit: string;
  refLow: number | null;
  refHigh: number | null;
  count: number;
  latest: LabRow | null;
  earliest: LabRow | null;
  trend: 'up' | 'down' | 'stable' | 'unknown';
  trendPercent: number | null;
  values: LabRow[];
}

/**
 * Group lab values by test_name and compute trend summary for each.
 */
export function summarizeLabs(labs: LabRow[]): LabSummary[] {
  const byTest = new Map<string, LabRow[]>();
  for (const lab of labs) {
    const existing = byTest.get(lab.test_name) ?? [];
    existing.push(lab);
    byTest.set(lab.test_name, existing);
  }

  const summaries: LabSummary[] = [];
  for (const [testName, rows] of byTest) {
    rows.sort((a, b) => new Date(b.collected_at).getTime() - new Date(a.collected_at).getTime());
    const known = DIABETES_LABS.find((l) => l.name === testName);
    const latest = rows[0] ?? null;
    const earliest = rows[rows.length - 1] ?? null;

    let trend: 'up' | 'down' | 'stable' | 'unknown' = 'unknown';
    let trendPercent: number | null = null;
    if (latest && earliest && rows.length >= 2 && latest.id !== earliest.id) {
      const latestVal = Number(latest.value);
      const earliestVal = Number(earliest.value);
      const delta = latestVal - earliestVal;
      trendPercent = earliestVal !== 0 ? (delta / earliestVal) * 100 : null;
      const threshold = Math.max(0.5, Math.abs(earliestVal) * 0.05);
      if (Math.abs(delta) < threshold) trend = 'stable';
      else if (delta > 0) trend = 'up';
      else trend = 'down';
    }

    summaries.push({
      test_name: testName,
      label: known?.label ?? testName.toUpperCase().replace(/_/g, ' '),
      unit: latest?.unit ?? known?.unit ?? '',
      refLow: latest?.reference_low ?? known?.refLow ?? null,
      refHigh: latest?.reference_high ?? known?.refHigh ?? null,
      count: rows.length,
      latest,
      earliest,
      trend,
      trendPercent,
      values: rows,
    });
  }

  // Order: A1C first, then by latest collection date desc
  return summaries.sort((a, b) => {
    if (a.test_name === 'a1c') return -1;
    if (b.test_name === 'a1c') return 1;
    const aDate = a.latest ? new Date(a.latest.collected_at).getTime() : 0;
    const bDate = b.latest ? new Date(b.latest.collected_at).getTime() : 0;
    return bDate - aDate;
  });
}

/** Is a value abnormal given its ref range? */
export function isValueAbnormal(value: number, refLow: number | null, refHigh: number | null): boolean | null {
  if (refLow == null && refHigh == null) return null;
  if (refLow != null && value < refLow) return true;
  if (refHigh != null && value > refHigh) return true;
  return false;
}

/**
 * Convert lab values to CSV string for export.
 * Columns: test_name, value, unit, ref_low, ref_high, is_abnormal, collected_at, notes
 */
export function labsToCSV(labs: LabRow[], patientName: string, patientMrn: string): string {
  const header = [
    'Patient',
    'MRN',
    'Test',
    'Value',
    'Unit',
    'Ref Low',
    'Ref High',
    'Abnormal',
    'Collected At',
    'Notes',
  ];

  const escape = (v: string | number | null | undefined) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const rows = labs.map((lab) =>
    [
      patientName,
      patientMrn,
      lab.test_name,
      lab.value,
      lab.unit,
      lab.reference_low ?? '',
      lab.reference_high ?? '',
      lab.is_abnormal === true ? 'YES' : lab.is_abnormal === false ? 'no' : '',
      lab.collected_at,
      lab.notes ?? '',
    ].map(escape).join(',')
  );

  return [header.join(','), ...rows].join('\n');
}

/** Trigger browser download of CSV string */
export function downloadCSV(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
