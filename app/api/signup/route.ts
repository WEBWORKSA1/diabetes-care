import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { z } from 'zod';

const SignupSchema = z.object({
  fullName: z.string().min(2).max(120),
  email: z.string().email().max(200),
  practiceName: z.string().min(2).max(200),
  npi: z.string().regex(/^\d{10}$/).optional().or(z.literal('')),
});

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}

export async function POST(request: Request) {
  let payload;
  try {
    payload = SignupSchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  const admin = createServiceClient();

  let slug = slugify(payload.practiceName);
  let attempt = 0;
  let orgId: string | null = null;
  while (attempt < 5 && !orgId) {
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 60);
    const { data, error } = await admin
      .from('organizations')
      .insert({
        name: payload.practiceName,
        slug: attempt === 0 ? slug : `${slug}-${attempt}`,
        plan: 'trial',
        trial_ends_at: trialEnd.toISOString(),
      })
      .select('id')
      .single();
    if (data) {
      orgId = data.id;
    } else if (error?.code === '23505') {
      attempt++;
    } else {
      return NextResponse.json({ error: 'Could not create practice' }, { status: 500 });
    }
  }
  if (!orgId) return NextResponse.json({ error: 'Practice name taken; try another.' }, { status: 409 });

  const { data: invite, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(payload.email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
    data: {
      full_name: payload.fullName,
      organization_id: orgId,
      role: 'owner',
      npi: payload.npi || null,
    },
  });

  if (inviteErr || !invite.user) {
    await admin.from('organizations').update({ deleted_at: new Date().toISOString() }).eq('id', orgId);
    return NextResponse.json({ error: inviteErr?.message ?? 'Could not send invite' }, { status: 500 });
  }

  const { error: userErr } = await admin.from('users').insert({
    id: invite.user.id,
    organization_id: orgId,
    email: payload.email,
    full_name: payload.fullName,
    role: 'owner',
    npi: payload.npi || null,
    is_active: true,
  });

  if (userErr) {
    console.error('[signup] user insert failed', userErr);
    return NextResponse.json({ error: 'Could not create provider account' }, { status: 500 });
  }

  await admin.from('audit_logs').insert({
    organization_id: orgId,
    user_id: invite.user.id,
    action: 'create',
    resource_type: 'organization',
    resource_id: orgId,
    metadata: { event: 'signup', practice_name: payload.practiceName },
  });

  return NextResponse.json({ ok: true, organizationId: orgId });
}
