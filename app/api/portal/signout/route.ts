import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { revokePortalSession, PORTAL_SESSION_COOKIE } from '@/lib/portal/auth';

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get(PORTAL_SESSION_COOKIE)?.value;
  if (token) {
    await revokePortalSession(token);
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(PORTAL_SESSION_COOKIE);
  return res;
}
