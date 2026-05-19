import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit';
import { z } from 'zod';

const WindowSchema = z.object({
  day_of_week: z.number().int().min(0).max(6),
  start_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  end_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  slot_duration_minutes: z.number().int().min(5).max(120).default(30),
  effective_from: z.string().nullable().optional(),
  effective_until: z.string().nullable().optional(),
});

const UpsertSchema = z.object({
  provider_id: z.string().uuid(),
  windows: z.array(WindowSchema),
});

/**
 * GET /api/scheduling/availability?provider_id=...
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const providerId = searchParams.get('provider_id');
  if (!providerId) return NextResponse.json({ error: 'provider_id required' }, { status: 400 });

  const { data } = await supabase
    .from('provider_availability')
    .select('*')
    .eq('provider_id', providerId)
    .eq('is_active', true)
    .order('day_of_week')
    .order('start_time');

  return NextResponse.json({ windows: data ?? [] });
}

/**
 * POST /api/scheduling/availability
 * Replaces all availability windows for the provider with the submitted set.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  let body;
  try {
    body = UpsertSchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json({ error: 'Invalid input', details: (err as Error).message }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from('users')
    .select('organization_id, role')
    .eq('id', user.id)
    .single();
  if (!profile) return NextResponse.json({ error: 'No profile' }, { status: 403 });

  // Only the provider themselves or an owner can edit
  if (body.provider_id !== user.id && profile.role !== 'owner') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Replace strategy: deactivate existing, insert new
  await supabase
    .from('provider_availability')
    .update({ is_active: false })
    .eq('provider_id', body.provider_id);

  if (body.windows.length > 0) {
    const rows = body.windows.map((w) => ({
      organization_id: profile.organization_id,
      provider_id: body.provider_id,
      day_of_week: w.day_of_week,
      start_time: w.start_time,
      end_time: w.end_time,
      slot_duration_minutes: w.slot_duration_minutes,
      effective_from: w.effective_from ?? null,
      effective_until: w.effective_until ?? null,
      is_active: true,
    }));
    const { error } = await supabase.from('provider_availability').insert(rows);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logAudit({
    organizationId: profile.organization_id,
    userId: user.id,
    action: 'update',
    resourceType: 'provider_availability',
    metadata: { provider_id: body.provider_id, window_count: body.windows.length },
  });

  return NextResponse.json({ ok: true });
}
