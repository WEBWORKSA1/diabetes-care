import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  visitVolumeWeekly, visitVolumeByProvider,
  a1cPopulation, a1cTrendMonthly,
  cgmEngagement,
  labGapA1c, labGapKidney,
  revenueMonthly,
  rowsToCSV,
  type ReportRange,
} from '@/lib/reports/queries';

/**
 * GET /api/reports/[type]?range=90d&format=json|csv
 *
 * type one of: visit_volume, visit_by_provider, a1c_population, a1c_trend,
 *              cgm_engagement, lab_gap_a1c, lab_gap_kidney, revenue
 */
export async function GET(
  request: Request,
  { params }: { params: { type: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const range = (searchParams.get('range') ?? '90d') as ReportRange;
  const format = (searchParams.get('format') ?? 'json') as 'json' | 'csv';

  let rows: any[] = [];
  let single: any = null;

  switch (params.type) {
    case 'visit_volume':
      rows = await visitVolumeWeekly(supabase as any, range);
      break;
    case 'visit_by_provider':
      rows = await visitVolumeByProvider(supabase as any);
      break;
    case 'a1c_population':
      single = await a1cPopulation(supabase as any);
      break;
    case 'a1c_trend':
      rows = await a1cTrendMonthly(supabase as any, 12);
      break;
    case 'cgm_engagement':
      single = await cgmEngagement(supabase as any);
      break;
    case 'lab_gap_a1c':
      rows = await labGapA1c(supabase as any);
      break;
    case 'lab_gap_kidney':
      rows = await labGapKidney(supabase as any);
      break;
    case 'revenue':
      rows = await revenueMonthly(supabase as any);
      break;
    default:
      return NextResponse.json({ error: 'Unknown report type' }, { status: 400 });
  }

  if (format === 'csv') {
    const data = single ? [single] : rows;
    const csv = rowsToCSV(data);
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="report_${params.type}_${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  }

  return NextResponse.json(single ? { row: single } : { rows });
}
