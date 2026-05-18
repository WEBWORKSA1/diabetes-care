/**
 * Dexcom API client
 *
 * Wraps the Dexcom Developer API (v3) for OAuth2 + EGV retrieval.
 * Sandbox: https://sandbox-api.dexcom.com
 * Production: https://api.dexcom.com  (requires partnership agreement)
 *
 * All endpoints use the same code path — switch via DEXCOM_API_BASE env var.
 *
 * Reference: https://developer.dexcom.com/docs/dexcomv3/
 */

const DEXCOM_API_BASE = process.env.DEXCOM_API_BASE ?? 'https://sandbox-api.dexcom.com';
const DEXCOM_CLIENT_ID = process.env.DEXCOM_CLIENT_ID ?? '';
const DEXCOM_CLIENT_SECRET = process.env.DEXCOM_CLIENT_SECRET ?? '';
const DEXCOM_REDIRECT_URI = process.env.DEXCOM_REDIRECT_URI ?? 'http://localhost:3000/api/cgm/dexcom/callback';

export interface DexcomTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number; // seconds
  token_type: string;
}

export interface DexcomEGV {
  recordId: string;
  systemTime: string; // ISO
  displayTime: string; // ISO
  value: number; // mg/dL
  status: string | null;
  trend?: string | null;
  trendRate?: number | null;
  unit: 'mg/dL' | 'mmol/L';
  rateUnit?: string | null;
}

/**
 * Build the Dexcom OAuth authorization URL.
 * State parameter ties the auth flow to a specific patient.
 */
export function buildAuthorizationUrl(state: string, scope = 'offline_access'): string {
  const params = new URLSearchParams({
    client_id: DEXCOM_CLIENT_ID,
    redirect_uri: DEXCOM_REDIRECT_URI,
    response_type: 'code',
    scope,
    state,
  });
  return `${DEXCOM_API_BASE}/v2/oauth2/login?${params.toString()}`;
}

/**
 * Exchange authorization code for access/refresh tokens.
 */
export async function exchangeCodeForTokens(code: string): Promise<DexcomTokens> {
  const body = new URLSearchParams({
    client_id: DEXCOM_CLIENT_ID,
    client_secret: DEXCOM_CLIENT_SECRET,
    code,
    grant_type: 'authorization_code',
    redirect_uri: DEXCOM_REDIRECT_URI,
  });

  const res = await fetch(`${DEXCOM_API_BASE}/v2/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Dexcom token exchange failed (${res.status}): ${text}`);
  }

  return res.json();
}

/**
 * Refresh an expired access token using a refresh token.
 */
export async function refreshAccessToken(refreshToken: string): Promise<DexcomTokens> {
  const body = new URLSearchParams({
    client_id: DEXCOM_CLIENT_ID,
    client_secret: DEXCOM_CLIENT_SECRET,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
    redirect_uri: DEXCOM_REDIRECT_URI,
  });

  const res = await fetch(`${DEXCOM_API_BASE}/v2/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Dexcom token refresh failed (${res.status}): ${text}`);
  }

  return res.json();
}

/**
 * Fetch estimated glucose values (EGVs) for a time range.
 * Max range is 90 days; the API will return up to ~7000 readings.
 */
export async function fetchEGVs(
  accessToken: string,
  startDate: Date,
  endDate: Date
): Promise<DexcomEGV[]> {
  const params = new URLSearchParams({
    startDate: startDate.toISOString().slice(0, 19), // Dexcom wants no Z suffix
    endDate: endDate.toISOString().slice(0, 19),
  });

  const res = await fetch(`${DEXCOM_API_BASE}/v3/users/self/egvs?${params.toString()}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
    },
  });

  if (res.status === 401) {
    throw new Error('DEXCOM_TOKEN_EXPIRED');
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Dexcom EGV fetch failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  // Dexcom v3 returns { recordType, recordVersion, userId, records: [...] }
  return (data.records ?? []) as DexcomEGV[];
}

/**
 * Whether we're configured to talk to Dexcom (creds present).
 */
export function isDexcomConfigured(): boolean {
  return !!(DEXCOM_CLIENT_ID && DEXCOM_CLIENT_SECRET);
}

export function getDexcomEnvironment(): 'sandbox' | 'production' | 'unknown' {
  if (DEXCOM_API_BASE.includes('sandbox')) return 'sandbox';
  if (DEXCOM_API_BASE.includes('api.dexcom.com')) return 'production';
  return 'unknown';
}
