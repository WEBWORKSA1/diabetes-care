# Environment variables reference

Every env var the app needs, where it goes, and how to get it.

## Required for any deploy

| Variable | Where set | How to get it |
|----------|-----------|--------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel: all environments | Supabase dashboard → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel: all environments | Supabase dashboard → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel: **server-only**, Production + Preview | Supabase dashboard → Settings → API. Keep SECRET. |
| `NEXT_PUBLIC_APP_URL` | Vercel: all environments | Your deployed app URL, e.g. `https://app.diabetes.care` |
| `NEXT_PUBLIC_PORTAL_URL` | Vercel: all environments | Your deployed portal URL, e.g. `https://patient.diabetes.care` |

## Required for AI Scribe

| Variable | Where set | How to get it |
|----------|-----------|--------------|
| `ANTHROPIC_API_KEY` | Vercel: server-only | console.anthropic.com. ENTERPRISE account with BAA before production use. |
| `OPENAI_API_KEY` | Vercel: server-only | platform.openai.com. ZDR ENTERPRISE account with BAA before production. |

## Required for Dexcom CGM

| Variable | Where set | How to get it |
|----------|-----------|--------------|
| `DEXCOM_CLIENT_ID` | Vercel: server-only | Dexcom developer portal. Sandbox value first, production after partner agreement. |
| `DEXCOM_CLIENT_SECRET` | Vercel: server-only | Dexcom developer portal |
| `DEXCOM_REDIRECT_URI` | Vercel: server-only | Must match what's registered in Dexcom portal. E.g. `https://app.diabetes.care/api/cgm/dexcom/callback` |
| `DEXCOM_OAUTH_BASE` | Vercel: server-only | `https://sandbox-api.dexcom.com` (sandbox) or `https://api.dexcom.com` (prod) |
| `DEXCOM_API_BASE` | Vercel: server-only | Same as OAUTH_BASE |
| `CGM_TOKEN_ENCRYPTION_KEY` | Vercel: server-only | `openssl rand -base64 32`. Generate once. SAVE IN PASSWORD MANAGER. Rotation is annual. |

## Required for SMS

| Variable | Where set | How to get it |
|----------|-----------|--------------|
| `TWILIO_ACCOUNT_SID` | Vercel: server-only | Twilio console. |
| `TWILIO_AUTH_TOKEN` | Vercel: server-only | Twilio console. |
| `TWILIO_PHONE_NUMBER` | Vercel: server-only | E.164 format, e.g. `+15558675309`. From Twilio. |

## Required for crons

| Variable | Where set | How to get it |
|----------|-----------|--------------|
| `CRON_SECRET` | Vercel: server-only | `openssl rand -hex 32`. Generate once. Must match Vercel's cron auth header. |

## Optional

| Variable | Where set | How to get it |
|----------|-----------|--------------|
| `SENTRY_DSN` | Vercel: server-only | Sentry project DSN if using error tracking |
| `POSTHOG_KEY` | Vercel: client-side OK | Only if you self-host PostHog. PostHog Cloud doesn't have BAA. |
| `POSTMARK_SERVER_TOKEN` | Vercel: server-only | Postmark account token (when email delivery is wired up) |

## Local development

Copy `.env.local.example` to `.env.local` and fill in development values (separate from prod). For Supabase, use a separate Supabase project for dev to avoid corrupting prod data.

```bash
cp .env.local.example .env.local
```

## Rotation policy

| Secret | Rotate every |
|--------|--------------|
| `SUPABASE_SERVICE_ROLE_KEY` | Annually, or immediately if compromised |
| `CGM_TOKEN_ENCRYPTION_KEY` | Annually (requires re-encrypting all stored tokens — procedure documented separately) |
| `CRON_SECRET` | Annually |
| `TWILIO_AUTH_TOKEN` | Annually |
| `ANTHROPIC_API_KEY` | If team member with access leaves |
| `OPENAI_API_KEY` | If team member with access leaves |

## Never do this

- Don't commit any .env file to git. (`.env*` should be in `.gitignore`. Verify.)
- Don't share env vars over Slack / Discord / email. Use a password manager with sharing (1Password, Bitwarden).
- Don't use the same secrets in dev and prod. Separate Supabase projects, separate keys.
- Don't store env vars in client-side React code unless prefixed `NEXT_PUBLIC_`. Anything else leaks to the browser.
