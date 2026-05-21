import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit';

/**
 * POST /api/compliance/toggle
 * Toggle a compliance checklist item between not_started and complete.
 * Owner-only. Form-data POST from server-rendered checklist.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const form = await request.formData();
  const itemKey = String(form.get('item_key') ?? '');
  const label = String(form.get('label') ?? '');
  const category = String(form.get('category') ?? '');
  const setTo = String(form.get('set_to') ?? 'complete');

  if (!itemKey || !label || !category) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from('users')
    .select('organization_id, role')
    .eq('id', user.id)
    .single();
  if (!profile) return NextResponse.json({ error: 'No profile' }, { status: 403 });
  if (profile.role !== 'owner') return NextResponse.json({ error: 'Owner only' }, { status: 403 });

  const admin = createServiceClient();
  const update: any = {
    organization_id: profile.organization_id,
    item_key: itemKey,
    label,
    category,
    status: setTo,
    completed_at: setTo === 'complete' ? new Date().toISOString() : null,
    completed_by: setTo === 'complete' ? user.id : null,
  };

  const { error } = await admin
    .from('compliance_items')
    .upsert(update, { onConflict: 'organization_id,item_key' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({
    organizationId: profile.organization_id,
    userId: user.id,
    action: 'update',
    resourceType: 'compliance_item',
    metadata: { item_key: itemKey, set_to: setTo },
  });

  // Redirect back to compliance page so form submission feels native
  return NextResponse.redirect(new URL('/app/settings/compliance', request.url));
}
