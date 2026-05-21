import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildInbox } from '@/lib/inbox/aggregator';

/**
 * GET /api/inbox?filter=mine|all
 * Returns the clinical inbox feed + count tiles for the current user.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const filterParam = searchParams.get('filter');
  const filter = filterParam === 'all' ? 'all' : 'mine';

  const { data: profile } = await supabase
    .from('users')
    .select('organization_id, inbox_filter_default')
    .eq('id', user.id)
    .single();
  if (!profile) return NextResponse.json({ error: 'No profile' }, { status: 403 });

  // Use provided filter or fall back to user's default
  const effectiveFilter: 'mine' | 'all' = filterParam
    ? filter
    : (profile.inbox_filter_default ?? 'mine') as 'mine' | 'all';

  const result = await buildInbox(supabase as any, {
    filter: effectiveFilter,
    organizationId: profile.organization_id,
    currentUserId: user.id,
    maxItems: 100,
  });

  return NextResponse.json({
    counts: result.counts,
    items: result.items,
    filter: effectiveFilter,
  });
}
