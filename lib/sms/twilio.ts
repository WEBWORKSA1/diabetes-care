/**
 * Twilio SMS client.
 *
 * Sends SMS via REST API. Handles E.164 normalization, opt-out checks at caller layer.
 * Requires BAA with Twilio for HIPAA.
 */

export interface TwilioSendResult {
  ok: boolean;
  sid?: string;
  status?: string;
  error_code?: string;
  error_message?: string;
}

function getConfig() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;
  if (!accountSid || !authToken || !fromNumber) {
    throw new Error('Twilio credentials not configured');
  }
  return { accountSid, authToken, fromNumber };
}

/**
 * Normalize phone to E.164. Accepts:
 *   '5551234567' -> '+15551234567' (assumes US)
 *   '(555) 123-4567' -> '+15551234567'
 *   '+15551234567' -> '+15551234567'
 */
export function normalizePhone(phone: string, defaultCountry: '1' = '1'): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `+${defaultCountry}${digits}`;
  if (digits.length === 11 && digits.startsWith(defaultCountry)) return `+${digits}`;
  if (phone.startsWith('+') && digits.length >= 10) return `+${digits}`;
  return null;
}

export async function sendSms(opts: {
  to: string;
  body: string;
}): Promise<TwilioSendResult> {
  const { accountSid, authToken, fromNumber } = getConfig();

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

  const body = new URLSearchParams({
    To: opts.to,
    From: fromNumber,
    Body: opts.body,
  });

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
      signal: AbortSignal.timeout(15_000),
    });

    const data = await res.json();

    if (!res.ok) {
      return {
        ok: false,
        error_code: String(data.code ?? res.status),
        error_message: data.message ?? 'Twilio API error',
      };
    }

    return {
      ok: true,
      sid: data.sid,
      status: data.status,
    };
  } catch (err) {
    return {
      ok: false,
      error_message: (err as Error).message,
    };
  }
}

/**
 * Verify Twilio webhook signature.
 * https://www.twilio.com/docs/usage/webhooks/webhooks-security
 */
export async function verifyTwilioSignature(
  signature: string,
  url: string,
  params: Record<string, string>
): Promise<boolean> {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) return false;

  // Sort params alphabetically, concatenate, prepend URL
  const sortedKeys = Object.keys(params).sort();
  const concatenated = sortedKeys.reduce((acc, k) => acc + k + params[k], url);

  const { createHmac } = await import('node:crypto');
  const computed = createHmac('sha1', authToken).update(concatenated).digest('base64');

  return computed === signature;
}
