/**
 * Patient portal authentication.
 *
 * NOT using Supabase Auth — patients shouldn't share the same auth pool as providers.
 * Instead: short-lived magic links delivered via SMS or email, exchanged for
 * an HTTP-only session cookie.
 *
 * Session lifetime: 24 hours, sliding renewal on activity.
 * Magic link lifetime: 7 days from creation, single-use.
 */

import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { createServiceClient } from '@/lib/supabase/server';

export const PORTAL_SESSION_COOKIE = 'dc_portal_session';
export const PORTAL_SESSION_DURATION_MS = 24 * 60 * 60 * 1000;
export const PORTAL_MAGIC_LINK_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

export interface PortalSession {
  id: string;
  organization_id: string;
  patient_id: string;
  expires_at: string;
}

export interface MagicLinkOptions {
  organizationId: string;
  patientId: string;
  destination?: 'home' | 'appointment' | 'intake' | 'results' | 'message';
  destinationRef?: string;
  sentVia?: 'sms' | 'email' | 'manual';
  expiresInMs?: number;
}

/**
 * Generate a magic link token. Returns the raw token (only shown once)
 * and stores its hash in the database.
 */
export async function createMagicLink(opts: MagicLinkOptions): Promise<{ token: string; id: string }> {
  const token = randomBytes(32).toString('base64url');

  const admin = createServiceClient();
  const { data, error } = await admin
    .from('portal_magic_links')
    .insert({
      organization_id: opts.organizationId,
      patient_id: opts.patientId,
      token,
      destination: opts.destination ?? 'home',
      destination_ref: opts.destinationRef ?? null,
      sent_via: opts.sentVia ?? 'sms',
      sent_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + (opts.expiresInMs ?? PORTAL_MAGIC_LINK_DURATION_MS)).toISOString(),
    })
    .select('id')
    .single();

  if (error || !data) {
    throw new Error('Failed to create magic link: ' + error?.message);
  }

  return { token, id: data.id };
}

/**
 * Build the full URL for a magic link.
 */
export function buildMagicLinkUrl(token: string): string {
  const base = process.env.NEXT_PUBLIC_PORTAL_URL
    ?? process.env.NEXT_PUBLIC_APP_URL
    ?? 'http://localhost:3000';
  return `${base}/portal/auth/${token}`;
}

/**
 * Consume a magic link: validate, mark consumed, create session.
 * Returns the new session token (set as cookie) and target destination.
 */
export async function consumeMagicLink(
  token: string,
  context: { ip?: string; userAgent?: string }
): Promise<
  | { ok: true; sessionToken: string; expiresAt: Date; destination: string; destinationRef: string | null; patientId: string; organizationId: string }
  | { ok: false; reason: 'not_found' | 'expired' | 'already_used' }
> {
  const admin = createServiceClient();

  const { data: link } = await admin
    .from('portal_magic_links')
    .select('*')
    .eq('token', token)
    .maybeSingle();

  if (!link) return { ok: false, reason: 'not_found' };
  if (link.consumed_at) return { ok: false, reason: 'already_used' };
  if (new Date(link.expires_at) < new Date()) return { ok: false, reason: 'expired' };

  // Mark consumed (atomic conditional update to prevent double-use)
  const { data: consumed } = await admin
    .from('portal_magic_links')
    .update({
      consumed_at: new Date().toISOString(),
      consumed_ip: context.ip ?? null,
      consumed_user_agent: context.userAgent?.slice(0, 500) ?? null,
    })
    .eq('id', link.id)
    .is('consumed_at', null)
    .select('id')
    .single();

  if (!consumed) return { ok: false, reason: 'already_used' };

  // Create session
  const sessionToken = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + PORTAL_SESSION_DURATION_MS);

  const { error: sessionErr } = await admin.from('portal_sessions').insert({
    organization_id: link.organization_id,
    patient_id: link.patient_id,
    session_token: sessionToken,
    expires_at: expiresAt.toISOString(),
    user_agent: context.userAgent?.slice(0, 500) ?? null,
    ip: context.ip ?? null,
  });

  if (sessionErr) throw new Error('Failed to create session: ' + sessionErr.message);

  return {
    ok: true,
    sessionToken,
    expiresAt,
    destination: link.destination,
    destinationRef: link.destination_ref,
    patientId: link.patient_id,
    organizationId: link.organization_id,
  };
}

/**
 * Read the current portal session from the cookie. Returns null if no
 * valid session is present.
 */
export async function getCurrentPortalSession(): Promise<PortalSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(PORTAL_SESSION_COOKIE)?.value;
  if (!token) return null;

  const admin = createServiceClient();
  const { data: session } = await admin
    .from('portal_sessions')
    .select('id, organization_id, patient_id, expires_at, revoked_at')
    .eq('session_token', token)
    .maybeSingle();

  if (!session) return null;
  if (session.revoked_at) return null;
  if (new Date(session.expires_at) < new Date()) return null;

  // Sliding renewal: update last_active_at
  await admin
    .from('portal_sessions')
    .update({ last_active_at: new Date().toISOString() })
    .eq('id', session.id);

  return {
    id: session.id,
    organization_id: session.organization_id,
    patient_id: session.patient_id,
    expires_at: session.expires_at,
  };
}

/**
 * Revoke the current session (sign out).
 */
export async function revokePortalSession(sessionToken: string): Promise<void> {
  const admin = createServiceClient();
  await admin
    .from('portal_sessions')
    .update({ revoked_at: new Date().toISOString() })
    .eq('session_token', sessionToken);
}

/**
 * Compose an SMS body for a magic-link delivery. Keeps it short and avoids PHI.
 */
export function composeMagicLinkSms(opts: {
  patientFirstName: string;
  practiceName: string;
  url: string;
  destination: string;
}): string {
  const intro =
    opts.destination === 'intake' ? 'fill out your pre-visit form' :
    opts.destination === 'appointment' ? 'view your appointment' :
    opts.destination === 'results' ? 'view your lab results' :
    'access your patient portal';

  return `${opts.patientFirstName}, sign in to ${intro} at ${opts.practiceName}: ${opts.url} (expires in 7 days). Reply STOP to opt out.`;
}
