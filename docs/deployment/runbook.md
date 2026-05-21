# Deployment runbook — zero to live in 1 day

When you decide to deploy, follow this end-to-end. Don't skip steps; don't reorder them. This is the order that minimizes blockers and avoids "waiting on a vendor" downtime.

## Pre-flight (do these now, even if you're not deploying today)

These have lead time. Start them weeks before you actually deploy.

- [ ] **Buy diabetes.care domain** — if not already owned. Check WHOIS.
- [ ] **Buy diabetes-care.com** as a defensive backup (cheap insurance against typos).
- [ ] **Buy patient-diabetes.care subdomain plan** — patient portal subdomain.
- [ ] **Sign up for Accountable HQ** (or comparable HIPAA service). $99/mo. Lead time: same-day.
- [ ] **Request Dexcom developer access** — lead time 4-12 weeks for production. Sandbox is instant.
- [ ] **Request Anthropic Enterprise BAA** — sales@anthropic.com. Lead time 1-3 weeks.
- [ ] **Decide on OpenAI** — ZDR Enterprise (expensive) or drop OpenAI and self-host Whisper on Hostinger VPS.
- [ ] **Buy cyber liability + E&O insurance** — Vouch or Embroker. Lead time 1-2 weeks.

## Deployment day — the actual sequence

Estimate: 6-8 focused hours if pre-flight is done.

### Step 1: Supabase project (30 min)

```bash
# 1.1 Sign up for Supabase Team plan ($599/mo). Required for BAA.
#     Use a long-lived org email, NOT a personal email.

# 1.2 Create new project: "diabetes-care-prod"
#     Region: closest to your users (us-east-1 for US East Coast)
#     DB password: 32+ chars, generated. SAVE IN PASSWORD MANAGER.

# 1.3 Request BAA via Supabase dashboard → Settings → Compliance.
#     They sign within 1-2 business days.

# 1.4 Enable Point-in-Time Recovery (PITR). Settings → Database.

# 1.5 Note these values for env vars:
#     - Project URL: https://<ref>.supabase.co
#     - anon public key
#     - service_role secret key (DO NOT EXPOSE; SERVER-SIDE ONLY)
```

### Step 2: Run all migrations in order (15 min)

From your local repo:

```bash
# 2.1 Connect to your new Supabase Postgres
export DATABASE_URL="postgres://postgres:<password>@db.<ref>.supabase.co:5432/postgres"

# 2.2 Run migrations 0001-0012 in order
for f in supabase/migrations/*.sql; do
  echo "Running $f..."
  psql "$DATABASE_URL" -f "$f"
done

# 2.3 Verify
psql "$DATABASE_URL" -c "\dt"  # Should show all tables
psql "$DATABASE_URL" -c "select count(*) from organizations;"  # 0
```

If any migration fails, **stop**. Don't keep going — fix it first or you'll have a corrupt schema.

### Step 3: Storage bucket for AI Scribe audio (5 min)

```bash
# 3.1 In Supabase dashboard → Storage → Create bucket
#     Name: scribe-audio
#     Public: NO
#     File size limit: 50MB

# 3.2 Add RLS policy on the bucket:
#     CREATE POLICY "Org members can access org audio" ON storage.objects
#     FOR ALL USING (
#       bucket_id = 'scribe-audio'
#       AND (storage.foldername(name))[1] = (auth.organization_id())::text
#     );
```

### Step 4: Generate secrets (5 min)

```bash
openssl rand -base64 32  # CGM_TOKEN_ENCRYPTION_KEY
openssl rand -hex 32     # CRON_SECRET
```

Save both. They go into env vars next.

### Step 5: Twilio (30 min, parallel with steps 6-7)

```bash
# 5.1 Sign up for Twilio. Paid plan (any).
# 5.2 Buy a phone number with SMS capability. ~$1/mo + usage.
# 5.3 Request BAA: twilio.com/legal/baa. They sign in 5-10 business days.
# 5.4 Note these values:
#     - TWILIO_ACCOUNT_SID
#     - TWILIO_AUTH_TOKEN
#     - TWILIO_PHONE_NUMBER (E.164 format, e.g. +15558675309)

# 5.5 Configure incoming webhook (after Vercel deploy in step 8):
#     Twilio Console → Phone Numbers → your number → Messaging
#     Webhook URL: https://app.diabetes.care/api/sms/inbound
#     HTTP POST
```

### Step 6: Vercel project (30 min)

```bash
# 6.1 Push repo to GitHub if not already.
# 6.2 Create Vercel project. Pro plan. Add HIPAA add-on (requires support ticket).
# 6.3 Connect GitHub repo. Framework: Next.js (auto-detected).
# 6.4 Set environment variables in Vercel → Settings → Environment Variables.
#     See env-vars.md for the full list.
# 6.5 First deploy will fail at the build because env vars aren't set yet. That's fine.
#     After setting them, trigger redeploy.
```

### Step 7: Domains (15 min)

```bash
# 7.1 In Vercel → Domains, add:
#     - app.diabetes.care (the provider app)
#     - patient.diabetes.care (the patient portal)
#     - diabetes.care (marketing site — if same repo)

# 7.2 Update DNS at your registrar:
#     A record: 76.76.21.21 (Vercel)
#     OR CNAME: cname.vercel-dns.com

# 7.3 Wait for DNS propagation (5-60 min). Vercel auto-issues SSL.
```

### Step 8: AI providers (30 min)

```bash
# 8.1 Anthropic
#     - Sign in at console.anthropic.com
#     - Make sure you have an enterprise account with BAA signed before launch
#     - Generate API key, save as ANTHROPIC_API_KEY

# 8.2 OpenAI (only if using — see decision in pre-flight)
#     - Sign in at platform.openai.com
#     - Enterprise account with ZDR + BAA
#     - Generate API key, save as OPENAI_API_KEY
```

### Step 9: Dexcom (skip for initial deploy if no production access yet)

```bash
# 9.1 If you have sandbox-only:
#     DEXCOM_OAUTH_BASE=https://sandbox-api.dexcom.com
#     DEXCOM_API_BASE=https://sandbox-api.dexcom.com
# 9.2 If you have production:
#     DEXCOM_OAUTH_BASE=https://api.dexcom.com
#     DEXCOM_API_BASE=https://api.dexcom.com

# 9.3 Configure OAuth callback URL in Dexcom developer portal:
#     https://app.diabetes.care/api/cgm/dexcom/callback
```

### Step 10: Final verification (30 min)

Walk through every critical path manually:

```bash
# 10.1 Visit https://diabetes.care — marketing landing loads
# 10.2 Click "Start trial" — signup page loads
# 10.3 Complete signup with a test email — redirected to /app
# 10.4 Verify onboarding checklist shows
# 10.5 Add a test patient — saves and redirects to patient detail
# 10.6 Try to add a lab — saves
# 10.7 Try the AI scribe — audio uploads, transcript generates
# 10.8 Send a portal magic link to yourself — receive SMS, click, land on portal
# 10.9 Fill out an intake form on the portal — submits
# 10.10 Check the inbox — submitted form appears
# 10.11 Try every report at /app/reports — all load with seed data
# 10.12 Check /app/settings/compliance — toggling works
# 10.13 Delete the test data when done
```

If any of these fail, **don't take on a real customer until they pass.**

### Step 11: Crons (5 min)

```bash
# 11.1 Vercel auto-reads vercel.json. Verify in Vercel → Settings → Cron Jobs:
#     - /api/cgm/cron       (hourly)
#     - /api/scribe/cron    (hourly :15)
#     - /api/sms/cron       (every 5 min)
# 11.2 Manually trigger each one with curl + CRON_SECRET header to verify.
```

### Step 12: Backups (5 min)

```bash
# 12.1 In Supabase, verify PITR is on (Settings → Database → Backups).
# 12.2 Test restore procedure to a branch:
#      Supabase → Branches → Create branch from backup point.
# 12.3 Document the restore procedure in your DR plan.
```

## After deploy — first 30 days

- [ ] Set up uptime monitoring (Better Uptime, free tier fine for solo)
- [ ] Set up error tracking (Sentry free tier)
- [ ] Set up log aggregation (Vercel logs are fine for now)
- [ ] Configure Twilio inbound webhook (step 5.5 above)
- [ ] Run `seed-demo.ts --signup` on production to create a permanent demo practice
- [ ] Bookmark the demo credentials
- [ ] Test the full demo flow alone, time yourself
- [ ] Send 5 cold emails using `docs/sales/cold-email-templates.md`
- [ ] Schedule first 2 discovery calls
- [ ] Continue working through `/app/settings/compliance` checklist

## What to do if something breaks during deploy

1. **Don't panic.** Most issues are env vars or migration order.
2. **Check Vercel build logs first.** Most errors show up there.
3. **If migrations failed:** restore from PITR to before they ran, fix the offending migration, re-run.
4. **If env vars are wrong:** Vercel → Settings → Environment Variables → fix → redeploy.
5. **If Twilio webhook isn't firing:** check the request signature verification in `app/api/sms/inbound/route.ts`. Twilio's signing key must match.
6. **If Dexcom OAuth fails:** the callback URL must match exactly what's registered in Dexcom developer portal. Includes the trailing slash convention.
7. **If patient portal magic links fail:** check that NEXT_PUBLIC_PORTAL_URL is set to the right subdomain. The cookie must be set on the right domain.

## Rollback procedure

If you deploy something broken:

```bash
# 1. Vercel → Deployments → find last good deploy → "Promote to Production"
#    (Takes 30 seconds)

# 2. If DB schema changed and is now incompatible:
#    Supabase → Branches → restore from PITR to pre-migration point
#    (Takes 5-15 minutes)

# 3. Notify any active users by email if there was downtime > 15 min.
```

Keep this runbook up to date as the stack evolves. Future you (or your first hire) will thank you.
