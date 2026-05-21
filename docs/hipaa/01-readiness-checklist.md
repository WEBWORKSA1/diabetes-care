# 01. Readiness Checklist

Work this top-to-bottom. Each item maps to an entry in `/app/settings/compliance` once you start tracking inside the app.

Legend: **[ ]** not started · **[~]** in progress · **[x]** done · **[–]** N/A

## Phase 1 — Foundation (Weeks 1–2)

- [ ] **Engage HIPAA support service.** Recommended: Accountable HQ ($99/mo, includes SRA tool + policies + training). Alternatives: Compliancy Group, HIPAA Vault.
- [ ] **Complete Risk Assessment.** Use SRA Tool from HHS (free) or vendor's built-in. Output is a document listing every identified risk + mitigation plan.
- [ ] **Designate a Privacy Officer + Security Officer.** Solo founders: same person. Document the designation in writing.
- [ ] **Inventory PHI flows.** Map every place patient data touches: form → DB → API → SMS → AI inference → backups.
- [ ] **Create cyber liability + E&O insurance quote.** $2K–$5K/year for a solo practice; expect underwriters to ask for SRA + BAA list. Vouch and Embroker handle SaaS health.

## Phase 2 — BAAs (Weeks 2–6, run in parallel with Phase 1)

- [ ] **Supabase BAA** — included with Team plan ($599/mo). Request at supabase.com/security.
- [ ] **Anthropic BAA** — enterprise plan required for full BAA; via sales@anthropic.com.
- [ ] **OpenAI BAA** — Zero Data Retention enterprise. Significantly higher cost than pay-as-you-go API. **Decision point.**
- [ ] **Twilio BAA** — must request, free with paid plan. Submit at twilio.com/legal/baa.
- [ ] **Vercel BAA** — Pro plan + HIPAA add-on (extra cost).
- [ ] **Dexcom partner agreement** — NOT a BAA (Dexcom is the source of truth); separate developer agreement.
- [ ] **DoseSpot BAA** — deferred until e-prescribing is wired up.
- [ ] **Postmark BAA** (if used for email) — paid plan + addendum.
- [ ] **PostHog** — PostHog Cloud doesn't sign BAAs. **Either** self-host PostHog with no PHI tracked **or** swap for a HIPAA-friendly analytics tool (Plausible self-host, Heap with BAA).

Full tracker: see `02-baa-tracker.md`.

## Phase 3 — Policies (Weeks 4–8)

At minimum, you need eight written policies. Templates in `04-policies/`:

- [ ] **Privacy policy** (HIPAA Privacy Rule) — how PHI is handled internally
- [ ] **Security policy** (HIPAA Security Rule) — administrative/physical/technical safeguards
- [ ] **Breach notification policy** (HIPAA Breach Notification Rule)
- [ ] **Access control + termination policy** — who gets what access, what happens when they leave
- [ ] **Audit and monitoring policy** — what gets logged, who reviews it, how often
- [ ] **Workforce training policy** — frequency, topics, sign-off
- [ ] **Contingency / disaster recovery plan** — backup, restore, alternate operations
- [ ] **Sanction policy** — consequences for staff violating PHI rules

## Phase 4 — Technical safeguards verification (Weeks 6–10)

- [ ] **Encryption at rest** — confirmed by Supabase Team + Vercel + Postmark. Document in policy.
- [ ] **Encryption in transit** — TLS 1.2+ enforced everywhere. Cert auto-renewal verified.
- [ ] **Audit logging** — every read/write to PHI logged with user, time, resource. Already implemented via `lib/audit`. **Action:** define retention (6 years minimum per HIPAA), monitoring frequency, and review schedule.
- [ ] **Backup procedure** — Supabase PITR is on; document restore procedure end-to-end. **Run a restore test.**
- [ ] **CGM token encryption** — already implemented with `CGM_TOKEN_ENCRYPTION_KEY`. Document key rotation policy (annual minimum).
- [ ] **Session timeout** — portal sessions are 24h sliding (Sprint 10). Provider sessions: confirm and document.
- [ ] **Penetration test** — once a year. $3K–$8K for a focused test. Vendors: Cobalt, NetSPI, or local independents.
- [ ] **Vulnerability scanning** — Snyk or GitHub Dependabot enabled on repo.

## Phase 5 — Operational readiness (Weeks 8–12)

- [ ] **Workforce training delivered** — record date, attendee, topics. See `05-workforce-training.md`.
- [ ] **Tabletop breach exercise** — simulate a breach end-to-end. 1 hour, document.
- [ ] **Incident response runbook** — see `06-breach-notification-protocol.md`. Internalize the 60-day notification clock.
- [ ] **Vendor due diligence process** — every new vendor that touches PHI must go through `07-vendor-due-diligence.md` before integration.

## Phase 6 — Ongoing (Monthly / Quarterly / Annual)

- [ ] **Monthly:** audit log review (sample 10 records)
- [ ] **Quarterly:** access review (who has access to what, still appropriate?)
- [ ] **Annual:** Risk Assessment refresh
- [ ] **Annual:** Policy review and update
- [ ] **Annual:** Workforce retraining
- [ ] **Annual:** Penetration test
- [ ] **Annual:** Backup restore test
