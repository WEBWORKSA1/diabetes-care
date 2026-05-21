import { NextResponse, type NextRequest } from 'next/server';
import { consumeMagicLink, PORTAL_SESSION_COOKIE } from '@/lib/portal/auth';

export const runtime = 'nodejs';

/**
 * GET /portal/auth/[token]
 * Magic link landing route. Exchanges token for session cookie and redirects.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? request.headers.get('x-real-ip')
    ?? null;
  const userAgent = request.headers.get('user-agent') ?? null;

  const result = await consumeMagicLink(params.token, {
    ip: ip ?? undefined,
    userAgent: userAgent ?? undefined,
  });

  if (!result.ok) {
    const reason = result.reason;
    const message =
      reason === 'expired' ? 'This link has expired. Ask your practice to send a new one.' :
      reason === 'already_used' ? 'This link has already been used. Ask your practice to send a new one.' :
      'This link is not valid. Ask your practice to send a new one.';
    return new NextResponse(renderError(message), {
      headers: { 'Content-Type': 'text/html' },
      status: 400,
    });
  }

  // Determine deep link
  let dest = '/portal';
  if (result.destination === 'intake' && result.destinationRef) {
    dest = `/portal/intake/${result.destinationRef}`;
  } else if (result.destination === 'appointment' && result.destinationRef) {
    dest = `/portal/appointments/${result.destinationRef}`;
  } else if (result.destination === 'results') {
    dest = '/portal/results';
  } else if (result.destination === 'message') {
    dest = '/portal/message';
  }

  const response = NextResponse.redirect(new URL(dest, request.url));
  response.cookies.set(PORTAL_SESSION_COOKIE, result.sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: result.expiresAt,
    path: '/',
  });
  return response;
}

function renderError(message: string): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Link not valid</title><style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:480px;margin:60px auto;padding:32px;color:#1a1a1a;line-height:1.6}h1{font-size:24px;margin-bottom:16px}p{color:#475569}</style></head><body><h1>Link not valid</h1><p>${message}</p></body></html>`;
}
