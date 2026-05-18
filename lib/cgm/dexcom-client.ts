/**
 * Dexcom API client.
 *
 * Implements OAuth 2.0 Authorization Code flow + EGV (Estimated Glucose Value) fetch.
 * Spec: https://developer.dexcom.com/
 *
 * Sandbox: https://sandbox-api.dexcom.com
 * Production: https://api.dexcom.com (requires partner agreement)
 *
 * The same code path serves both — only the base URL differs.
 */

export interface DexcomTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number; // seconds
  token_type: 'Bearer';
}

export interface DexcomEGV {
  systemTime: string; // ISO 8601
  displayTime: string; // ISO 8601
  value: number; // mg/dL
  trend?: 'doubleUp' | 'singleUp' | 'fortyFiveUp' | 'flat' | 'fortyFiveDown' | 'singleDown' | 'doubleDown' | 'none' | 'notComputable' | 'rateOutOfRange';
  trendRate?: number; // mg/dL/min
  unit: 'mg/dL';
}

export interface DexcomEGVResponse {
  unit: 'mg/dL';
  rateUnit: 'mg/dL/min';
  records: DexcomEGV[];
}

const DEFAULT_TIMEOUT_MS = 30_000;

function getConfig() {
  const base = process.env.DEXCOM_API_BASE ?? 'https://sandbox-api.dexcom.com';
  const clientId = process.env.DEXCOM_CLIENT_ID;
  const clientSecret = process.env.DEXCOM_CLIENT_SECRET;
  const redirectUri = process.env.DEXCOM_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Dexcom credentials not configured. Set DEXCOM_CLIENT_ID, DEXCOM_CLIENT_SECRET, DEXCOM_REDIRECT_URI.');
  }
  return { base, clientId, clientSecret, redirectUri };
}

function normalizeTrend(t?: string): string {
  switch (t) {
    case 'doubleUp': return 'rapid_rise';
    case 'singleUp': return 'rising';
    case 'fortyFiveUp': return 'slowly_rising';
    case 'flat': return 'stable';
    case 'fortyFiveDown': return 'slowly_falling';
    case 'singleDown': return 'falling';
    case 'doubleDown': return 'rapid_fall';
    default: return 'unknown';
  }
}

/**
 * Build the Dexcom OAuth authorization URL.
 * The patient clicks this to authorize their data.
 */
export function buildAuthorizationUrl(state: string, scope: string = 'offline_access'): string {
  const { base, clientId, redirectUri } = getConfig();
  const url = new URL(`${base}/v2/oauth2/login`);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', scope);
  url.searchParams.set('state', state);
  return url.toString();
}

/** Exchange authorization code for access + refresh tokens. */
export async function exchangeCodeForTokens(code: string): Promise<DexcomTokens> {
  const { base, clientId, clientSecret, redirectUri } = getConfig();

  const body = new URLSearchParams({
    client_secret: clientSecret,
    client_id: clientId,
    code,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
  });

  const res = await fetch(`${base}/v2/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Dexcom token exchange failed (${res.status}): ${text}`);
  }
  return res.json();
}

/** Refresh access token using stored refresh token. */
export async function refreshAccessToken(refreshToken: string): Promise<DexcomTokens> {
  const { base, clientId, clientSecret, redirectUri } = getConfig();

  const body = new URLSearchParams({
    client_secret: clientSecret,
    client_id: clientId,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
    redirect_uri: redirectUri,
  });

  const res = await fetch(`${base}/v2/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Dexcom token refresh failed (${res.status}): ${text}`);
  }
  return res.json();
}

/** Fetch EGV (estimated glucose values) for a date range. */
export async function fetchEGVs(
  accessToken: string,
  startDate: Date,
  endDate: Date
): Promise<DexcomEGVResponse> {
  const { base } = getConfig();

  // Dexcom API requires startDate < endDate and a max range of ~90 days.
  // Date format: YYYY-MM-DDTHH:MM:SS (no Z, no ms)
  const fmt = (d: Date) => d.toISOString().slice(0, 19);

  const url = new URL(`${base}/v3/users/self/egvs`);
  url.searchParams.set('startDate', fmt(startDate));
  url.searchParams.set('endDate', fmt(endDate));

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
  });

  if (!res.ok) {
    const text = await res.text();
    if (res.status === 401) {
      throw new DexcomAuthError('Access token expired or invalid');
    }
    throw new Error(`Dexcom EGV fetch failed (${res.status}): ${text}`);
  }
  return res.json();
}

/** Convert a Dexcom EGV record to our internal cgm_readings row shape. */
export function egvToReading(
  egv: DexcomEGV,
  patientId: string,
  organizationId: string,
  connectionId: string
) {
  return {
    patient_id: patientId,
    organization_id: organizationId,
    connection_id: connectionId,
    recorded_at: egv.systemTime,
    glucose_mg_dl: egv.value,
    trend: normalizeTrend(egv.trend),
    raw_payload: egv as unknown as Record<string, unknown>,
  };
}

export class DexcomAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DexcomAuthError';
  }
}
