# 03. Risk Assessment Template (SRA Tool format)

Use this scaffold if you choose to run the HHS SRA Tool yourself. **Recommended alternative:** let your HIPAA support service (Accountable HQ etc.) run it for you the first year. The output is the same; theirs is faster.

The SRA Tool produces ~200 questions across seven sections. This is a condensed working version focused on what's actually different for diabetes.care.

## Section A — Administrative Safeguards

| Question | Answer | Mitigation | Status |
|----------|--------|------------|--------|
| Has a Security Officer been designated? | Web (founder, solo) | Documented in policy | |
| Has a Privacy Officer been designated? | Web | Documented in policy | |
| Workforce training program in place? | | See `05-workforce-training.md` | |
| Sanction policy in place? | | See policy template | |
| Information access management procedure? | RBAC via Supabase RLS + role on `users` table | Document in access policy | |
| Audit log review process? | `audit_log` table; review monthly | Define schedule | |
| Periodic security evaluation? | Annual SRA refresh | | |
| BAAs in place with all subprocessors? | See `02-baa-tracker.md` | Pending | |
| Contingency plan documented? | | See policy template | |
| Termination procedures? | Disable user, revoke sessions, rotate creds if applicable | Document | |

## Section B — Physical Safeguards

Mostly N/A for cloud-only SaaS, but document:

| Question | Answer | Status |
|----------|--------|--------|
| Facility access controls? | N/A — cloud only (Supabase, Vercel) | |
| Workstation security policy? | Solo workstation: full-disk encryption, screen lock, no PHI on local disk in production | |
| Mobile device policy? | If using phone for SMS/portal QA, no patient data stored locally | |
| Device and media disposal? | N/A for cloud | |

## Section C — Technical Safeguards

| Question | Answer | Status |
|----------|--------|--------|
| Access control — unique user IDs? | Supabase Auth (one user = one auth row) | ✓ |
| Emergency access procedure? | Service role key in secure manager, rotated annually | |
| Automatic logoff? | Portal: 24h sliding. Provider: TBD; confirm value | |
| Encryption at rest? | Supabase Postgres native + storage encryption | ✓ |
| Encryption in transit? | TLS 1.2+ everywhere, HSTS enabled | |
| Audit controls? | `audit_log` table; immutable; reviewed monthly | partial |
| Integrity controls? | Soft-delete + audit trail; no destructive UI actions for clinical data | ✓ |
| Transmission security? | TLS for all client ↔ server; signed Twilio webhooks | ✓ |

## Section D — Identified risks (top 10 for our stack)

| Risk | Likelihood | Impact | Mitigation | Owner | Status |
|------|-----------|--------|------------|-------|--------|
| AI model accidentally trains on PHI | Low (BAA prohibits) | High | Verify BAA terms; never use non-BAA Claude.ai/ChatGPT for work | Web | |
| Magic link token interception via SMS hijack | Low | Medium | Short expiry (7d), single-use, IP logging | Web | ✓ (Sprint 10) |
| Provider account compromise | Medium | High | Strong password + MFA (TBD), session timeout, audit log | Web | partial |
| Dexcom OAuth token theft via XSS | Low | High | HTTP-only encrypted storage of refresh tokens | Web | ✓ (Sprint 5) |
| Audit log tampering | Low | High | Insert-only table, RLS prevents update/delete | Web | ✓ |
| Backup data exposure | Low | High | Supabase-managed; document restore process; test annually | Web | |
| Insider abuse (Web himself viewing patients out of scope) | Low (solo founder) | High | Self-audit log review; admin actions explicitly logged | Web | |
| BAA lapse | Medium | Medium | Annual BAA review (Jan) | Web | |
| Misdirected SMS to wrong phone | Low | Medium | Phone validation at intake; consent required | Web | partial |
| Patient using portal on shared device | Medium | Low | Session expiry, sign-out button prominent, no auto-save | Web | ✓ (Sprint 10) |

## Section E — Action plan

For every "partial" or unchecked item above, write the owner + due date. Track in `/app/settings/compliance`.
