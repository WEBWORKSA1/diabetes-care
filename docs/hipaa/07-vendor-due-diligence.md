# 07. Vendor Due Diligence Checklist

Before integrating any new third-party service that may touch PHI, run through this checklist. Block the integration until every item is answered.

## Pre-integration questions

- [ ] **What PHI does this vendor process?** (Names, identifiers, clinical data, all of the above, none?)
- [ ] **Does this vendor offer a BAA?**
  - If no: stop. Either don't integrate, or de-identify before sending.
  - If yes: get the BAA template before signing the commercial agreement.
- [ ] **What's the vendor's HIPAA / SOC 2 / HITRUST posture?** Request their security overview document.
- [ ] **Where is the data stored?** US-only? Cloud regions? Are backups stored in different regions?
- [ ] **What's their breach notification SLA to you?** (HIPAA requires BAs to notify CEs within 60 days; faster is better.)
- [ ] **Encryption at rest?** AES-256 expected.
- [ ] **Encryption in transit?** TLS 1.2+ expected.
- [ ] **Access controls?** Role-based access on their side; how do their staff access customer data?
- [ ] **Subprocessors?** Does this vendor use other vendors that touch the data? Document the chain.
- [ ] **Data deletion / portability?** Can you delete all PHI on demand? In what timeframe?
- [ ] **Logging / audit access?** Can you see their audit logs of access to your data?
- [ ] **Insurance?** Cyber liability coverage limits.
- [ ] **Contractual termination?** Data handling on contract end.

## Risk classification

Assign one of three tiers based on PHI exposure:

- **Tier 1 — Full PHI access** (Supabase, Anthropic, OpenAI, Twilio, Vercel)
  - BAA mandatory.
  - Annual review.
  - High change-management discipline.
- **Tier 2 — Limited or de-identified data** (analytics, monitoring)
  - BAA preferred; data-use agreement minimum.
  - Annual review.
- **Tier 3 — No PHI** (dev tools, marketing site analytics on landing page only)
  - No BAA required.
  - Standard SaaS contract.
  - Document why PHI cannot reach this vendor.

## Approval

New Tier 1 or Tier 2 vendors require:
1. Completed checklist above.
2. Privacy Officer approval (signed).
3. Risk Assessment update.
4. Add to `02-baa-tracker.md`.
5. Add to `compliance_items` and `baa_log` tables.

## Annual review

Every January, run through every existing vendor in `02-baa-tracker.md`:
- BAA still in effect?
- Vendor's security posture changed?
- Any reported incidents at vendor?
- Is the vendor still necessary?
