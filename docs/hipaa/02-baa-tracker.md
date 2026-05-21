# 02. BAA Tracker

Every subprocessor that touches Protected Health Information (PHI) must have a signed Business Associate Agreement (BAA). This is the highest-priority paperwork.

Track the same data in `/app/settings/compliance` once that page is live; this file is the source-of-truth for new orgs.

## Required BAAs for diabetes.care

| Vendor | Category | Tier required | Status | Notes |
|--------|----------|---------------|--------|-------|
| Supabase | Cloud infra (DB, auth, storage) | Team ($599/mo) | _to request_ | BAA template at supabase.com/legal. Required before any real PHI lands in DB. |
| Anthropic | AI inference (Claude for scribe + summarization) | Enterprise | _to request_ | sales@anthropic.com. Standard API tier doesn't include BAA. |
| OpenAI | AI inference (Whisper + GPT-4o for scribe) | Zero Data Retention enterprise | _to request_ | Significantly more expensive than standard API. **Consider:** drop OpenAI and run Whisper self-hosted on Hostinger VPS if cost-prohibitive. |
| Twilio | SMS (appointment reminders, magic links) | Any paid plan | _to request_ | twilio.com/legal/baa. Submit form, signed within 5–10 business days. |
| Vercel | App hosting | Pro + HIPAA add-on | _to request_ | HIPAA add-on is paid; pricing on request. Required for app.diabetes.care and patient.diabetes.care. |
| Dexcom | CGM data source | Partner agreement (not BAA) | _in progress_ | Dexcom is data source, not Business Associate. Partner agreement covers data use. 4–12 weeks to approve production access. |
| Postmark | Transactional email (future) | Paid plan + signed addendum | _not_required_yet_ | Only needed when email delivery is added (currently SMS-only). |
| PostHog | Product analytics | **No BAA available on Cloud** | _decision_pending_ | Either: (a) self-host PostHog with no PHI in events, (b) swap for HIPAA-friendly tool, (c) disable analytics. **Decision needed before launch.** |
| Anthropic (you-as-customer) | If you use Claude.ai for your own work and might paste any patient data | n/a | _policy_only_ | **Policy:** Never paste PHI into Claude.ai consumer or any non-BAA tool. Use the diabetes.care app itself, which has proper BAA flow. |

## How to request a BAA (generic template email)

```
Subject: Business Associate Agreement request — <Practice name>

Hi <vendor> team,

<Practice name> is a HIPAA-covered entity using <vendor product> to process Protected Health Information. We need to execute a Business Associate Agreement before going live.

Key points:
- Plan: <plan name and tier>
- Account email: <signing email>
- Use case: <one sentence on what PHI flows through their system>
- Signing authority: <name, title>

Could you send your standard BAA template, or let me know your process? Happy to use yours or ours.

Thanks,
<Your name>
<Practice name>
```

## What if a vendor refuses or doesn't offer a BAA?

You have three options:

1. **Drop them.** Hardest but cleanest.
2. **De-identify the data** before it reaches them (e.g. PostHog can track UI events without PHI). Document this in policy.
3. **Self-host the equivalent.** PostHog open-source, Plausible self-host, Postal for email.

## Annual review

Set a calendar reminder to verify each BAA is still in force every January. Vendors occasionally let BAAs lapse or require re-execution after product changes (e.g. when they spin up a new region).
