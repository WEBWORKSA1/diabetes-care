import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateSlots, getDateRange } from '@/lib/scheduling/availability';

/**
 * GET /api/scheduling/slots?provider_id=...&start=YYYY-MM-DD&days=14
 * Returns generated bookable slots for the provider.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const providerId = searchParams.get('provider_id');
  const startStr = searchParams.get('start');
  const days = Math.min(60, Math.max(1, Number(searchParams.get('days') ?? 14)));

  if (!providerId) return NextResponse.json({ error: 'provider_id required' }, { status: 400 });

  const rangeStart = startStr ? new Date(startStr) : new Date();
  const { start, end } = getDateRange(rangeStart, days);

  const [{ data: windows }, { data: timeOff }, { data: booked }] = await Promise.all([
    supabase
      .from('provider_availability')
      .select('id, day_of_week, start_time, end_time, slot_duration_minutes, effective_from, effective_until')
      .eq('provider_id', providerId)
      .eq('is_active', true),
    supabase
      .from('provider_time_off')
      .select('starts_at, ends_at')
      .eq('provider_id', providerId)
      .gte('ends_at', start.toISOString())
      .lte('starts_at', end.toISOString()),
    supabase
      .from('appointments')
      .select('starts_at, ends_at, status')
      .eq('provider_id', providerId)
      .is('deleted_at', null)
      .gte('starts_at', start.toISOString())
      .lte('starts_at', end.toISOString())
      .not('status', 'in', '(cancelled,no_show)'),
  ]);

  const slots = generateSlots({
    rangeStart: start,
    rangeEnd: end,
    windows: (windows ?? []) as any,
    timeOff: (timeOff ?? []) as any,
    booked: (booked ?? []) as any,
  });

  return NextResponse.json({
    slots,
    range: { start: start.toISOString(), end: end.toISOString() },
  });
}
