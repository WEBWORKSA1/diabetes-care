# Production launch checklist

Print this. Tape it to your wall. Walk every line on launch day before going live with paying customers.

## Pre-launch (1-2 weeks before)

- [ ] All migrations 0001-0012 run successfully on production Supabase
- [ ] Storage bucket `scribe-audio` created with correct RLS policy
- [ ] Domain DNS pointed at Vercel; SSL certs issued and working
- [ ] All env vars set in Vercel (production environment)
- [ ] Crons configured and verified firing on schedule
- [ ] Twilio inbound webhook configured
- [ ] Dexcom OAuth callback URL registered in their portal
- [ ] Sentry / error tracking configured
- [ ] Uptime monitoring configured (Better Uptime, free tier)
- [ ] Backup PITR enabled, retention verified
- [ ] First backup restore test completed

## BAAs / Legal

- [ ] Supabase BAA signed
- [ ] Anthropic Enterprise BAA signed
- [ ] OpenAI ZDR Enterprise BAA signed (or OpenAI removed from stack)
- [ ] Twilio BAA signed
- [ ] Vercel HIPAA add-on enabled with signed BAA
- [ ] Dexcom partner agreement signed (sandbox → production access granted)
- [ ] Cyber liability + E&O insurance policy in force
- [ ] Pilot agreement template reviewed by attorney
- [ ] BAA template reviewed by attorney

## HIPAA

- [ ] Risk Assessment completed and documented
- [ ] Privacy Officer + Security Officer designated in writing
- [ ] 8 written policies adopted (privacy, security, breach, access, audit, training, DR, sanction)
- [ ] Workforce training completed and signed off
- [ ] Breach notification protocol pinned to runbook
- [ ] Vendor due diligence completed for every subprocessor
- [ ] `/app/settings/compliance` checklist marked at 100% (or all critical items)

## Application QA

Walk through every flow manually. None of these should fail.

- [ ] Marketing landing loads at root domain
- [ ] Signup creates a new practice + owner
- [ ] Login works for the new owner
- [ ] Adding a patient succeeds and shows on detail page
- [ ] Editing a patient saves changes
- [ ] Adding a lab manually works
- [ ] CGM OAuth flow completes end-to-end (use sandbox or test patient)
- [ ] CGM data syncs and appears on patient page
- [ ] AI scribe records, transcribes, generates SOAP draft
- [ ] SOAP draft can be edited and signed
- [ ] Appointment can be booked
- [ ] SMS reminder fires for an upcoming appointment (test phone)
- [ ] STOP reply correctly opts the patient out
- [ ] Portal magic link sends and opens portal
- [ ] Portal intake form submits successfully
- [ ] Portal results page shows released labs
- [ ] Inbox shows all expected item types
- [ ] Inbox bulk-review of labs works
- [ ] All 5 reports load and export to CSV
- [ ] Compliance toggles save and persist

## Demo readiness

- [ ] Demo practice created via `seed-demo.ts --signup`
- [ ] Demo credentials saved in password manager
- [ ] Demo data looks realistic when navigating
- [ ] You've timed yourself doing the demo — under 8 minutes
- [ ] You've practiced answering all 12 objections in `docs/sales/objection-handling.md`

## Marketing site

- [ ] Landing page copy is current
- [ ] Pricing is listed correctly (or behind "Request a demo")
- [ ] Privacy Notice (HIPAA NPP) is linked in footer
- [ ] Terms of Service is linked in footer
- [ ] Contact email is monitored
- [ ] OG image / favicon are set
- [ ] Site loads in under 2 seconds (lighthouse score 90+)

## Communications

- [ ] Support email forwarding set up
- [ ] Calendly or scheduling link for discovery calls
- [ ] LinkedIn profile updated to reflect founder role
- [ ] Cold email templates loaded into Gmail / Superhuman
- [ ] First 30 prospects identified and in tracking spreadsheet
- [ ] First 5 emails sent

## Day-of launch

- [ ] Final smoke test: complete every QA step above
- [ ] Tweet / post launch announcement (optional but recommended)
- [ ] Email any warm intros to schedule discovery calls
- [ ] Monitor logs for first 4 hours
- [ ] Celebrate. You shipped.

## Week 1 post-launch

- [ ] Daily check: error rates, uptime, signups
- [ ] Schedule at least 5 discovery calls
- [ ] Run first weekly office hours / check-in with pilot customers (when you have them)
- [ ] Continue working through compliance checklist any items still open
- [ ] First pen test scheduled (if not pre-launch)

## What "done" looks like

Launch isn't "we deployed." Launch is:

1. Real URL anyone can visit
2. Real practice can sign up and use it with real patients
3. BAAs in place to permit real PHI
4. You can hand a procurement officer your security package and they say "OK"
5. You have at least 1 paying or piloting customer

If any of these is missing, you launched a demo. Demos are fine. Just call them that internally so you don't lose track of what "shipped" means.
