# HIPAA Compliance — Working Documents

This folder is the practical workspace for getting diabetes.care HIPAA-ready before signing the first paying customer. Nothing here is legal advice. Hire a HIPAA consultant (Accountable HQ, Compliancy Group, or similar) before going live with real PHI.

## What's in here

| File | Purpose |
|------|---------|
| `01-readiness-checklist.md` | Master checklist of every HIPAA task, in execution order |
| `02-baa-tracker.md` | Every subprocessor + BAA status |
| `03-risk-assessment-template.md` | SRA Tool-format risk analysis template |
| `04-policies/` | Eight required written policies |
| `05-workforce-training.md` | Training outline + sign-off log template |
| `06-breach-notification-protocol.md` | What to do in the first 24-72 hours of a suspected breach |
| `07-vendor-due-diligence.md` | How to evaluate any new subprocessor |
| `08-cost-estimate.md` | What HIPAA actually costs Year 1 |

## Order of operations

1. **Read** `01-readiness-checklist.md`. Print it. Tape it to your wall.
2. **Engage a HIPAA consultant.** Quote $1.5K–$3K for SRA + policy review (Accountable HQ runs ~$99/mo with SRA included). Don't try to do the Risk Assessment unassisted on Year 1.
3. **Request BAAs** from every subprocessor in `02-baa-tracker.md`. This takes 1–6 weeks per vendor; start now.
4. **Adapt policy templates** in `04-policies/` to your practice. The templates are starting points, not final docs.
5. **Train your workforce.** Even if it's just you, document the training and date.
6. **Track everything** in the app at `/app/settings/compliance` so reviewers can see your status in one screen.

## What "HIPAA compliance" actually means for a 1-person SaaS

There's no government-issued certification. You're compliant if you can demonstrate three things to OCR (Office for Civil Rights) if they ever audit:

1. **You've done a Risk Assessment** and have policies that address every identified risk
2. **You have signed BAAs** with every subprocessor that touches PHI
3. **You've trained your workforce** and have a documented Breach Notification protocol

The biggest fines come from item #1 not being done, not from technical breaches. Do the paperwork.

## Honest take from Web's perspective

If you're a solo founder bootstrapping, the Accountable HQ option ($99/mo) gives you 80% of what a $25K consulting engagement gives you and pays for itself the first time a prospect asks for your SOC 2 / HIPAA package. Decision was already made in the sprint plan — this folder helps you execute against it.
