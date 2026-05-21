# 06. Breach Notification Protocol

**Discovery to internal notification: 24 hours.**
**Affected individual notification: within 60 days of discovery.**

This is the runbook to follow the moment a potential breach is suspected. Print it; pin it.

## What counts as a breach?

Under HIPAA, a breach is any "acquisition, access, use, or disclosure of PHI not permitted by the Privacy Rule that compromises the security or privacy of the PHI."

**Yes:**
- Unauthorized provider account accessed a patient record outside their patient panel.
- Email containing PHI sent to wrong recipient.
- Lost laptop with cached PHI.
- Malware on a workstation that handled PHI.
- Supabase RLS bug exposed cross-org data.
- Magic link delivered to wrong phone number.

**No (technically):**
- Encrypted-and-unread PHI lost (e.g., encrypted backup tape).
- Disclosure to another covered entity for TPO.
- Limited dataset shared per a data use agreement.

**When in doubt, treat it as a breach** and document the analysis.

## Step-by-step (first 24 hours)

### Hour 0–1: Discovery
1. **Stop the bleeding.** Disable the affected account, revoke compromised tokens, take the offending feature down. Don't delete anything — you need evidence.
2. **Notify Privacy Officer.** Email or call.
3. **Open an incident document.** Date, time, who discovered, initial description.

### Hour 1–6: Triage
1. **Determine scope.** Use audit log + `cgm_alerts` + Twilio logs to identify:
   - Which patient records were affected.
   - When the unauthorized access happened.
   - What data was viewed or modified.
2. **Preserve evidence.** Screenshot logs. Export the relevant `audit_log` rows. Don't truncate.
3. **Engage HIPAA support service.** Notify them immediately so they can advise on next steps.

### Hour 6–24: Risk Assessment
Document these four factors per 45 CFR 164.402:
1. **Nature and extent of PHI involved.** (Identifiers? Diagnoses? Notes?)
2. **Unauthorized recipient.** (Who saw it? Did they retain it?)
3. **Was the PHI actually acquired or viewed?** (Or just exposed in transit?)
4. **Extent to which risk has been mitigated.** (Recovered? Confirmed deleted?)

If the four-factor analysis shows **low probability of compromise**, you may document the incident as "not a reportable breach." Keep the documentation regardless.

## Days 1–60: Notifications

### Affected individuals (always, if reportable)
- **Method:** First-class mail to last known address, or email if the patient has opted in.
- **Content:** brief description, types of info affected, what patient should do, what you are doing, contact info.
- **Substitute notice** required if you can't reach >10 patients: prominent website notice + media if >500.

### HHS Secretary
- **>500 affected:** within 60 days, via the OCR breach portal.
- **<500 affected:** in annual report submitted within 60 days of year-end.
- Portal: ocrportal.hhs.gov/ocr/breach

### Media
- **Required if >500 individuals in a single state or jurisdiction** are affected.
- Issue press release to prominent local outlets within 60 days.

### Business Associates (i.e. you, when a downstream subprocessor is the source)
- BA must notify Covered Entity within 60 days.
- If you are the BA: notify your customer practices.

## After the incident

- **Update the SRA** to reflect any newly identified risks.
- **Update policies** if procedures need to change.
- **Document corrective action.** What did you change to prevent recurrence?
- **Update workforce training** if behavior change is needed.

## What you'll want pre-staged before the event

- [ ] Template breach notification letter (one for individuals, one for media).
- [ ] Cyber liability insurance carrier contact info.
- [ ] HIPAA consultant contact info.
- [ ] Legal counsel contact info (data breach experience).
- [ ] PR / crisis comms contact (or budget for one).
