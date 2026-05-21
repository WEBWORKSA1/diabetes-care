# Operational runbooks

What to do when things go wrong, broken down by scenario. Keep this open during your first 30 days of production.

## On-call expectations (solo founder)

- **Business hours response:** within 1 hour
- **After-hours response:** best effort, within 4 hours for critical issues
- **Critical:** site down, data loss, security breach
- **High:** feature broken affecting multiple users
- **Normal:** bug affecting 1 user or workaround exists
- **Low:** UI polish, feature request

When you sign more than 5 customers, document this explicitly in your support SLA so customers don't expect 24/7.

## Scenario: Site is down (5xx errors)

1. **Check Vercel status:** vercel-status.com
2. **Check Vercel deployment:** is the latest deploy errored?
   - If yes, promote previous good deployment.
3. **Check Supabase status:** status.supabase.com
4. **Check Vercel logs:** Vercel dashboard → Logs → filter to 5xx
5. If the issue is in your code: hotfix or revert.

**Communication:** if down > 15 minutes during business hours, email all active customers with status update.

## Scenario: Patient portal magic link doesn't work

Most common causes:
1. **Link expired.** 7-day TTL. Send a new one from the patient detail page.
2. **Already consumed.** Magic links are single-use. Send a new one.
3. **Cookie not being set.** Check `NEXT_PUBLIC_PORTAL_URL` matches the actual portal subdomain.
4. **Patient phone bounced.** Check `appointment_reminders` table for the delivery status.

Debug query:
```sql
SELECT * FROM portal_magic_links
WHERE patient_id = '<patient-id>'
ORDER BY created_at DESC
LIMIT 5;
```

## Scenario: CGM data stopped syncing for a patient

1. **Check connection status:**
   ```sql
   SELECT id, device, is_active, last_synced_at, sync_status, last_error, consecutive_failures
   FROM cgm_connections WHERE patient_id = '<patient-id>';
   ```
2. **If `sync_status = 'token_expired':** Token refresh failed. Have the patient re-authorize.
3. **If `consecutive_failures > 5`:** Connection auto-disabled. Inspect `last_error`.
4. **If `last_synced_at` is days old but status is 'active':** Cron may not be firing. Manually trigger:
   ```bash
   curl -X GET https://app.diabetes.care/api/cgm/cron -H "Authorization: Bearer $CRON_SECRET"
   ```
5. **Check Vercel cron logs** to verify the cron is running on schedule.

## Scenario: AI scribe is generating bad SOAP drafts

1. **Check the audio quality.** Was the recording clear? Try replaying it in the session detail.
2. **Check the transcript.** Is Whisper's transcription accurate? If transcript is wrong, SOAP will be wrong.
3. **Check both LLM outputs.** Are Claude and GPT-4o producing similar drafts? If they disagree, the source content is probably ambiguous.
4. **Check the prompt.** If you changed the SOAP prompt recently, it may need tuning. Roll back to last-known-good prompt and test.
5. **Check the guardrails.** Are the 3 guardrails (PHI filter, hallucination check, completeness check) firing correctly?

If a customer reports persistent bad output, ask for a specific session ID and review it manually. Use it to improve prompts.

## Scenario: SMS reminders aren't being sent

1. **Check Twilio account status:** is the account in good standing? Did billing fail?
2. **Check `appointment_reminders` table:**
   ```sql
   SELECT status, count(*) FROM appointment_reminders
   WHERE scheduled_at > now() - interval '24 hours'
   GROUP BY status;
   ```
3. **If status='pending' but past `scheduled_at`:** cron isn't firing. Trigger manually.
4. **If status='failed':** check `last_error`. Most common: invalid phone number, opt-out, Twilio account suspended.
5. **If status='opted_out':** patient sent STOP. Cannot send unless they send START to opt back in.

## Scenario: Patient signs up but onboarding state isn't created

1. The trigger `trg_onboarding_state_create` should fire on org INSERT.
2. If missing, manually insert:
   ```sql
   INSERT INTO onboarding_state (organization_id) VALUES ('<org-id>');
   ```
3. Investigate why trigger didn't fire — likely a migration ordering issue.

## Scenario: A customer wants to export all their data

1. Go to `/app/reports`. Every report has a CSV export button.
2. For patient-level data not covered by reports, generate a CSV from psql:
   ```sql
   COPY (
     SELECT p.mrn, p.first_name, p.last_name, p.date_of_birth, p.diabetes_type, ...
     FROM patients p WHERE p.organization_id = '<org-id>' AND p.deleted_at IS NULL
   ) TO STDOUT WITH CSV HEADER;
   ```
3. For audio files (scribe), provide ZIP of the patient's `scribe-audio` storage folder.
4. Document the export in `audit_log`.
5. Done within 14 days per pilot agreement.

## Scenario: A customer is leaving — data deletion

1. Confirm in writing they want all data deleted (not just "cancel my subscription").
2. Wait 30 days after cancellation (per agreement) in case they change their mind.
3. Execute deletion:
   ```sql
   DELETE FROM organizations WHERE id = '<org-id>';
   -- All child tables cascade via FK
   ```
4. Confirm deletion via `select count(*) from <each-table> where organization_id = '<org-id>';`
5. Delete their storage bucket folder.
6. Send written confirmation of deletion.
7. Document in your own records.

## Scenario: Suspected security incident

**STOP. Read `docs/hipaa/06-breach-notification-protocol.md` before doing anything else.**

1. Don't delete logs.
2. Don't change credentials yet (first preserve evidence).
3. Notify your HIPAA support service.
4. Begin the 4-factor analysis.
5. Document everything.
6. The 24-hour internal notification + 60-day external notification clock starts at discovery.

## Scenario: Customer asks for something you can't deliver

1. **Don't say "we can't."** Say "not today — here's our roadmap."
2. **Don't promise a date** unless you're 90%+ confident.
3. **Document the request** in a backlog file or Linear/Notion.
4. **If multiple customers ask for the same thing:** that's the next sprint's roadmap.
5. **If they need it to renew:** decide if the work is worth keeping them. Sometimes the right answer is "we're not a fit for you anymore."

## Backups + recovery test

Run this quarterly:

1. Pick a recent date (e.g., 24 hours ago).
2. In Supabase, create a branch from that PITR point.
3. Connect to the branch DB and verify data is consistent.
4. Drop the branch.
5. Document the date of the test and the result.

Never skip this. Backups you've never tested are not backups.
