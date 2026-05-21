# Local development setup

For working on the codebase locally before deploying.

## Requirements

- Node.js 20+
- npm or pnpm
- A Supabase project (free tier is fine for development)
- Optional: Stripe CLI for billing testing (not needed yet)

## First-time setup

```bash
# Clone
git clone https://github.com/WEBWORKSA1/diabetes-care.git
cd diabetes-care

# Install
npm install

# Set up local env
cp .env.local.example .env.local
# Edit .env.local — see docs/deployment/env-vars.md for what to set
```

## Database setup

Use a separate Supabase project for dev (not prod). Free tier is fine.

```bash
# Get the DATABASE_URL from Supabase → Settings → Database → Connection string
export DATABASE_URL="postgres://postgres:<dev-password>@db.<dev-ref>.supabase.co:5432/postgres"

# Run all migrations
for f in supabase/migrations/*.sql; do
  psql "$DATABASE_URL" -f "$f"
done

# Create storage bucket for AI scribe audio
# In Supabase dashboard: Storage → Create bucket "scribe-audio" → Private
```

## Seed demo data

```bash
npm run seed:demo -- --signup
```

This creates a demo practice with 30 patients, 6 months of clinical history, CGM data, etc. Prints the credentials.

## Start the dev server

```bash
npm run dev
```

Open http://localhost:3000.

## Common local dev tasks

### Reset everything

```bash
# Drop all data, keep schema
psql "$DATABASE_URL" -c "TRUNCATE organizations CASCADE;"

# Re-seed
npm run seed:demo -- --signup
```

### Run a single migration

```bash
psql "$DATABASE_URL" -f supabase/migrations/0011_reporting.sql
```

### Test crons locally

Crons don't fire automatically in dev. Trigger manually:

```bash
curl -X GET http://localhost:3000/api/cgm/cron \
  -H "Authorization: Bearer $CRON_SECRET"
```

### Test SMS without spending money

Twilio has a magic test phone number: `+15005550006`. SMS to it always "succeeds" but doesn't actually send. Use it as the patient phone for testing.

### Test AI scribe without burning API credits

The scribe pipeline has a `MOCK_LLM` mode (TODO: implement) that returns canned SOAP notes. For now, use very short audio recordings (10-15 seconds) when testing locally.

### Test patient portal without sending real SMS

The `/api/portal/invite` endpoint returns the magic link URL in its response. Copy it from the browser network tab and paste it into your browser to test the portal flow.

## Troubleshooting

### "relation does not exist" errors

Migrations didn't all run. Re-run them in order:

```bash
for f in supabase/migrations/*.sql; do
  echo "Running $f..."
  psql "$DATABASE_URL" -f "$f"
done
```

### Supabase Auth errors

The service role key has full access; the anon key respects RLS. If you're getting "no rows returned" but you expect data, you're probably using the anon key when you need the service role key (or vice versa).

### CGM OAuth fails locally

Dexcom OAuth callbacks require HTTPS. For local testing, use a tunnel:

```bash
# Install ngrok or cloudflared
ngrok http 3000
# Use the https URL in DEXCOM_REDIRECT_URI
```

### TypeScript errors after pulling main

```bash
rm -rf .next node_modules
npm install
npm run typecheck
```

### "Hydration failed" errors

Usually caused by a Date object rendered differently on server vs client. Wrap in `useEffect` or render only on client. Or use `suppressHydrationWarning` on the offending element.
