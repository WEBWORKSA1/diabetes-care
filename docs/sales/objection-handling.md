# Objection handling

The 12 objections you will hear repeatedly. Memorize the responses; they will come fast.

## 1. "We're already on {EHR}."

**Bad response:** "But ours is better."

**Good response:** "Of course — every endo is on something. The question is whether what you have is good enough that switching even 1 part of your workflow isn't worth 15 minutes. If you're genuinely happy with your charting time on diabetes visits, I should stop talking. Are you?"

If yes → polite close.
If they hesitate → keep going.

## 2. "Switching EHRs is a nightmare."

**Good response:** "Agreed — and we're not asking you to switch. The first 5-10 patients you onboard takes 10 minutes each. Many practices keep their old EHR for legacy patients and use us for new patients + their diabetes cohort. You can run both in parallel until the new one earns the right to take over."

This is the "wedge" pitch. It works.

## 3. "Is this HIPAA compliant?"

**Good response:** "Yes — we have BAAs with every subprocessor (Supabase for the database, Anthropic and OpenAI for the AI scribe, Twilio for SMS, Vercel for hosting). We run an annual Risk Assessment, full audit logging on every PHI access, encryption at rest and in transit. Want me to send our security overview?"

Then send `docs/hipaa/` as a PDF.

**If you don't have BAAs signed yet:** "We're in the process of finalizing BAAs with all subprocessors — will be done before any real patient data lands on the platform. For now, the trial uses synthetic data only."

Don't lie. Don't pretend you're further along than you are. Endos will eventually find out and will trust you more for the honesty.

## 4. "What about my staff? They hate change."

**Good response:** "That's a real concern. Two things: first, your front-desk doesn't need to change anything if you don't want them to — scheduling, intake, and reminders all work the same way they're used to. Second, the AI scribe is for you, not them, so it doesn't affect their workflow at all. You can roll out the parts they touch slowly."

## 5. "How much does this cost?"

**Good response:** "Pricing is $399/month for a solo practice, with discounts for groups. AI scribe is a $99/month add-on per provider. Patient engagement is another $149/month per provider. But honestly — before we talk price, I want to make sure the product solves your problem. Can we keep talking and come back to price?"

If they push: "Solo is $399/mo, no per-seat fees for staff. AI scribe $99 add-on. That's it."

Do NOT volunteer pricing in the discovery call. Wait until they ask.

## 6. "How do I know you'll still be around in 2 years?"

**Good response:** "Fair question. I'm bootstrapping, not VC-funded — which means I won't get pulled in 12 directions by a board. The flip side is I'm one person, so the risk you're worried about is real. The mitigation: we use standard tools (Postgres, S3-compatible storage, FHIR-compatible export format) so if I get hit by a bus, you can take your data and move to any EHR in the country. Want me to show you the export?"

Then actually show them the CSV export from `/app/reports`.

## 7. "We use {Athena / eCW / etc}. Will this integrate?"

**Good response:** "Not directly today. We export CSVs and FHIR bundles for any data you want to push elsewhere. For most practices that use us as the diabetes-specific layer, the integration question stops mattering because they use us as the source of truth for their diabetes panel. Tell me more about why you'd want them connected — there might be a workflow we should think about."

Note: don't promise integrations you can't deliver in 90 days.

## 8. "What about labs? We have a contract with {Quest / LabCorp}."

**Good response:** "Right now we do manual lab entry — quick form, 11 common diabetes labs pre-loaded. Most practices send a copy to us during the trial period. Direct Quest/LabCorp HL7 integration is on the roadmap; for the trial we want to validate the workflow first, then wire up the feed."

Honest. They'll appreciate it.

## 9. "What about e-prescribing?"

**Good response:** "Not in the product today. We're integrating DoseSpot for e-prescribing, controlled substances, and prior auth. Timeline is roughly {next 60 days / when we have 5+ pilot customers}. For the trial, you'd keep using your current e-prescribing tool. Is that a deal-breaker for you?"

If yes → polite close. If no → keep going.

Don't oversell. E-Rx is genuinely a 4-8 week DoseSpot integration once a customer asks.

## 10. "The AI scribe — does it train on my patient data?"

**Good response:** "No. We use Anthropic and OpenAI under enterprise BAAs with zero data retention. Your patient audio is processed, transcribed, summarized, and the audio is deleted within 24 hours by default — you can lower that to 'delete after SOAP draft is generated' in settings. The text of the SOAP note stays in your database, encrypted, like any other chart note."

This is true if you have the BAAs signed. Don't claim it before you do.

## 11. "I've tried other AI scribes — they hallucinate."

**Good response:** "Every AI scribe hallucinates sometimes. Three things we do that most don't: we use two LLMs in parallel (Claude and GPT-4o) and flag disagreements for your review, we link every line in the SOAP draft back to the audio segment that supports it so you can verify, and we never auto-sign — you always read and approve. The hallucination rate isn't zero, but it's catchable, which is the only thing that matters clinically."

Demo this if they're skeptical.

## 12. "This sounds too good to be true."

**Good response:** "It's not. Here's what's not great about it: I'm one person, so support is me answering email between coding sessions. We don't have e-prescribing yet, so you'd use your current tool for that. We don't have direct lab feed yet, so you enter labs manually. We don't have a billing module, so you'd export visit counts and run claims through your existing billing tool. We're a really good diabetes EHR layer, not a complete replacement. If you want everything from one vendor, we're not there yet."

The honest pitch lands. Endos who've been burned by overpromising vendors will reward you for it.

## When to walk away from a deal

- They want enterprise features (multi-location, complex RBAC) you don't have
- They want it to be free
- They want a guarantee of uptime / SLA you can't honor as a solo founder
- They're hostile or condescending on the call (life's too short)
- They want you to white-label the product

Some customers cost more than they're worth. The right close in those cases is: "I don't think we're a fit right now. Here's a recommendation for {alternative}. Happy to revisit in 12 months if things change."

You earn long-term reputation by not chasing every deal.
