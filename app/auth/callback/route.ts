import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/app';

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error?.message ?? 'auth_failed')}`);
  }

  const { data: userRow } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', data.user.id)
    .single();

  if (userRow) {
    await logAudit({
      organizationId: userRow.organization_id,
      userId: data.user.id,
      action: 'login',
      resourceType: 'session',
    });

    await supabase
      .from('users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', data.user.id);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
