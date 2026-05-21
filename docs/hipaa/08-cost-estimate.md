# 08. HIPAA Year-1 Cost Estimate

Honest budget for a solo founder going from "code works" to "can sign a paying endocrinologist with their compliance officer's blessing."

## One-time costs (Year 1)

| Item | Vendor | Cost | Notes |
|------|--------|------|-------|
| Risk Assessment + Policy Pack | Accountable HQ or similar | $99/mo (annualized $1,188) | Includes SRA tool, policy templates, workforce training portal |
| Alternative: Standalone HIPAA consultant | Compliancy Group, HIPAAtrek | $2.5K–$5K | Higher touch, one-time engagement |
| Penetration test | Cobalt, NetSPI, local | $3K–$8K | Focused on the API + auth surface. Recommended before first paid customer. |
| Cyber liability + E&O insurance | Vouch, Embroker | $2K–$5K/yr | $1M per occurrence / $1M aggregate is standard for solo SaaS. |
| Legal review of policies + BAA templates | Health IT attorney | $1K–$3K | One-off; even if you use templates. |
| **One-time total** | | **$6.5K–$17K** | Skip the pen test in Year 0 if cash-constrained; do it before customer #2. |

## Recurring costs (Year 1+)

| Item | Cost | Notes |
|------|------|-------|
| Accountable HQ (or eq.) | $99/mo = $1,188/yr | Ongoing policy maintenance + training portal |
| Supabase Team (BAA included) | $599/mo = $7,188/yr | Required for any real PHI |
| Vercel Pro + HIPAA add-on | $20/mo Pro + extra HIPAA fee (request pricing) | Estimate ~$1K–$3K/yr |
| Twilio (BAA on paid plan) | Usage-based | ~$50–$200/mo at pilot scale |
| Anthropic (BAA via enterprise) | TBD; enterprise pricing | Get quote; possibly $500–$2K/mo at pilot scale |
| OpenAI (ZDR enterprise) | Significantly more than pay-as-you-go | Decision point; may be cheaper to self-host Whisper |
| Penetration test | $3K–$8K/yr | Annual |
| Cyber liability + E&O | $2K–$5K/yr | Annual |
| **Recurring total** | **~$20K–$40K/yr** | Heavily depends on AI inference volume |

## Breakeven math

At Solo pricing ($399/mo):
- 1 customer covers: $4,788/yr.
- **5 customers** ($23,940/yr) covers infrastructure but not pen test or insurance.
- **10 customers** ($47,880/yr) covers everything plus modest founder income.
- **20 customers** ($95,760/yr) covers everything plus reasonable founder income.

At 200-provider goal in the locked plan ($500 blended), $1.2M ARR. Compliance is a rounding error at that scale.

## What to budget for Sprint 12 (paperwork)

If you do nothing else right now:
- Sign up for Accountable HQ today: **$99/mo**.
- Allocate **8–16 hours of your own time** over the next 4 weeks to complete the SRA + policy adoption.
- Add a calendar reminder for cyber liability quote shopping in 30 days.

That's the minimum to be "in good faith compliant." Penetration test, formal legal review, and insurance can wait until you have a signed pilot customer who asks for them — which is exactly when you'll have the cash to pay for them.
