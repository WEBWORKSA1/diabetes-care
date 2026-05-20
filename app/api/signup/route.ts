import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { z } from 'zod';

const SignupSchema = z.object({
  // Practice
  practice_name: z.string().min(2).max(200),
  practice_phone: z.string().max(30).optional(),
  practice_timezone: z.string().default('America/New_York'),
  // Owner
  full_name: z.string().min(2).max(150),
  credentials: z.string().max(50).optional(),
  email: z.string().email().max(200),
  password: z.string().min(8).max(200),
  npi: z.string().regex(/^\d{10}$/).optional(),
});

/**
 * POST /api/signup
 * Creates a new organization + owner user.
 *
 * Public endpoint — no auth required (this IS the auth bootstrap).
 * Uses service role to create auth user + insert org/user records.
 */
export async function POST(request: Request) {
  let body;
  try {
    body = SignupSchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json({ error: 'Invalid input', details: (err as Error).message }, { status: 400 });
  }

  const admin = createServiceClient();

  // 1. Check email isn't already in use
  const { data: existingUser } = await admin
    .from('users')
    .select('id')
    .eq('email', body.email.toLowerCase())
    .maybeSingle();

  if (existingUser) {
    return NextResponse.json({ error: 'An account with this email already exists. Sign in instead.' }, { status: 409 });
  }

  // 2. Create auth user (Supabase Auth)
  const { data: authUser, error: authErr } = await admin.auth.admin.createUser({
    email: body.email.toLowerCase(),
    password: body.password,
    email_confirm: true,
    user_metadata: {
      full_name: body.full_name,
    },
  });

  if (authErr || !authUser?.user) {
    console.error('[signup] auth user create failed', authErr);
    return NextResponse.json({ error: 'Could not create account', details: authErr?.message }, { status: 500 });
  }

  const userId = authUser.user.id;

  // 3. Create organization
  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + 30); // 30-day trial

  const { data: org, error: orgErr } = await admin
    .from('organizations')
    .insert({
      name: body.practice_name,
      phone: body.practice_phone ?? null,
      timezone: body.practice_timezone,
      plan: 'trial',
      trial_ends_at: trialEndsAt.toISOString(),
      sms_from_name: body.practice_name,
    })
    .select('id')
    .single();

  if (orgErr || !org) {
    console.error('[signup] org create failed', orgErr);
    // Roll back auth user
    await admin.auth.admin.deleteUser(userId).catch(() => {});
    return NextResponse.json({ error: 'Could not create practice', details: orgErr?.message }, { status: 500 });
  }

  // 4. Create user profile linked to org as owner
  const { error: profileErr } = await admin
    .from('users')
    .insert({
      id: userId,
      organization_id: org.id,
      email: body.email.toLowerCase(),
      full_name: body.full_name,
      credentials: body.credentials ?? null,
      npi: body.npi ?? null,
      role: 'owner',
      is_active: true,
    });

  if (profileErr) {
    console.error('[signup] profile create failed', profileErr);
    // Roll back org + auth user
    await admin.from('organizations').delete().eq('id', org.id).catch(() => {});
    await admin.auth.admin.deleteUser(userId).catch(() => {});
    return NextResponse.json({ error: 'Could not create profile', details: profileErr.message }, { status: 500 });
  }

  // 5. onboarding_state row is auto-created by trigger from 0008 migration

  return NextResponse.json({
    ok: true,
    organization_id: org.id,
    user_id: userId,
    trial_ends_at: trialEndsAt.toISOString(),
  });
}
