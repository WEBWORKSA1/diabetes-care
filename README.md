# diabetes.care

**The diabetes co-pilot for endocrinology practices.**

A HIPAA-compliant clinical SaaS platform purpose-built for endocrinology practices managing diabetic patients. Sits alongside the existing EHR — does not replace it.

---

## What we're building

A narrow, deep, diabetes-specific clinical platform:

- **AI Scribe** — Record visit, get structured SOAP note in 60 seconds (Whisper + Claude)
- **CGM Integration** — Dexcom (v1), Abbott Libre & Medtronic (v1.1) — all data in one view
- **A1C / Glucose Dashboard** — Trending, time-in-range, AGP reports
- **Diabetes-Specific Charting** — Pre-built SOAP templates for T1, T2, gestational, prediabetes, insulin titration
- **Patient Management** — Demographics, medications, allergies, diagnoses
- **Scheduling + SMS Reminders** — Twilio-backed
- **Billing Exports** — Superbills for existing billing services

**Not in v1**: Full EHR replacement, claims processing, lab ordering, telemedicine, e-prescribing (added in v1.1).

---

## Pricing (target)

| Tier | Price | For |
|------|-------|-----|
| Independent | $399/provider/mo | Solo endocrinology practices |
| Small Practice | $299/provider/mo | 2–5 endocrinologists |
| Multi-Site | $249/provider/mo | 6+ endocrinologists |

**Add-ons:**
- AI Scribe — +$99/provider/mo
- Patient Engagement — +$149/provider/mo

**Path to $1M ARR:** 200 providers at ~$500/mo blended = $100K MRR = $1.2M ARR in 18 months.

---

## Tech stack

- **Frontend**: Next.js 14 + Tailwind + shadcn/ui
- **Backend**: Supabase Team ($599/mo, HIPAA BAA) — Postgres + Auth + Realtime + Storage
- **AI**: OpenAI Whisper (transcription) + Anthropic Claude (clinical note generation)
- **CGM**: Dexcom API (v1), Abbott LibreLinkUp + Tidepool (v1.1)
- **E-Prescribing**: DoseSpot (v1.1)
- **Payments**: Stripe (BAA)
- **Email**: Postmark (BAA)
- **SMS**: Twilio (BAA)
- **Analytics**: PostHog Cloud (BAA)
- **Hosting**: Vercel Pro with HIPAA add-on

**Monthly infra cost during build**: ~$1,200–$1,800
**Monthly infra cost at 50 customers**: ~$2,500–$3,500

---

## HIPAA posture

BAAs in place / required with every vendor handling PHI:
- [x] Supabase Team plan
- [x] Vercel HIPAA add-on
- [x] Anthropic API
- [x] OpenAI API
- [x] Postmark
- [x] Twilio
- [x] Stripe

SOC 2 Type 1 audit planned post-revenue (Q3 2027).

---

## Project status

| Sprint | Deliverable | Status |
|--------|-------------|--------|
| 1 | Marketing site (`index.html`) | ✅ Shipped |
| 2 | Next.js app scaffold + Supabase schema + auth | 🔨 In progress |
| 3 | Patient management + diabetes charting templates | ⏳ Pending |
| 4 | A1C + glucose dashboard | ⏳ Pending |
| 5 | Dexcom CGM integration | ⏳ Pending |
| 6 | AI scribe (Whisper + Claude pipeline) | ⏳ Pending |
| 7 | Scheduling + SMS + Stripe billing + beta onboarding | ⏳ Pending |
| 8 | HIPAA audit pass + security hardening | ⏳ Pending |
| 9 | First beta endo onboarded | ⏳ Pending |

---

## Deployment

The marketing site is a single-file static HTML. To deploy:

### Option 1 — Vercel (recommended)
```bash
npm i -g vercel
vercel --prod
```

Then add `diabetes.care` as custom domain in the Vercel dashboard.

### Option 2 — Netlify Drop
Drag-drop the repo folder to https://app.netlify.com/drop

### Option 3 — Cloudflare Pages
Connect this GitHub repo to Cloudflare Pages. No build command, output dir: `/`.

---

## Founder

**Web** — building from Montréal and Delaware.

---

## License

Proprietary. All rights reserved.
