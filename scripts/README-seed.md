# Demo seed data

Fastest way to populate a fresh diabetes.care instance with realistic data for demos, screenshots, or showing prospects what a populated app looks like.

## What you get

- **30 patients** across diabetes types (T2DM 22, T1DM 5, Prediabetes 3) and A1C bands (very_high 4, high 6, borderline 8, at_goal 9, normal 3)
- **6 months of A1C trends** per patient (gives the population health report something to show)
- **Lipid + kidney labs** (with some intentional gaps so the lab-gaps report has rows)
- **30 days of CGM data** for 15 patients (Dexcom-shaped, ~2,880 readings each, with dawn phenomenon + postprandial spikes baked in)
- **Past 90 days of completed visits** + **next 14 days of upcoming visits**
- **4 unsigned encounters** (sitting in the inbox for the demo)
- **3 CGM alerts** including 1 critical (severe hypo overnight)
- **3 submitted intake forms** including 1 with PHQ-2 flagging + foot wound (so the intake review screen shows the amber clinical-concern highlighting)
- **Onboarding state marked complete** so the checklist doesn't show

## Run it

### Option A — Brand new demo practice

```bash
npm install
DATABASE_URL=... npm run seed:demo -- --signup
```

This creates a fresh org + owner user. It prints the credentials at the end. Sign in, you're done.

### Option B — Seed an existing practice

```bash
DATABASE_URL=... npm run seed:demo -- --org-id=<uuid> --provider-id=<uuid>
```

Use this if you already signed up via `/signup` and just want to add data on top.

## What it doesn't seed

- **Stripe customers / subscriptions** — there's no billing yet.
- **Twilio messages** — the seed data references `sms_consent` but won't actually send SMS. The data sits in the DB ready to display.
- **Dexcom OAuth tokens** — connections are marked active with placeholder encrypted tokens. No real Dexcom polling happens; the seeded readings simulate what a working sync produces.
- **Real BAAs or compliance items** — the compliance checklist at `/app/settings/compliance` is untouched. That's intentional — you don't want the demo to look like you've signed BAAs you haven't.

## Resetting between demos

```bash
# Delete everything for a given org (will cascade through all tables)
psql "$DATABASE_URL" -c "DELETE FROM organizations WHERE id = '<org-id>';"
```

Then re-run the seed.

## What this seed is NOT

It's not synthetic patient data for training models. It's not PHI-safe in any HIPAA sense (it's fake, but the structure is real). Don't import this into a production practice.
