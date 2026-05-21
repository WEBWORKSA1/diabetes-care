# Demo walkthrough (7 minutes)

The demo happens at the end of the discovery call. By now you know their pain points. Show them the 2-3 things that match. Skip everything else.

## Pre-demo setup

Make sure your demo practice (created by `seed-demo.ts --signup`) has:
- 30 patients
- Today's date has at least 3 scheduled visits
- The inbox has at least 5 items (4 unsigned encounters + 3 CGM alerts + 3 submitted intake forms + abnormal labs)
- The compliance checklist shows some progress

Run a dry-run alone first. Time yourself.

## The 7-minute script

### Minute 1: Today screen

```
This is what you'd see when you log in.

[Open /app]

You get a personal greeting, then immediately the inbox — everything pending across the practice. Critical items at the top: a patient just checked in, a critical CGM alert from last night, 2 abnormal labs that haven't been reviewed.

The tile on the left shows urgent items combined — these get priority. The toggle here lets me filter to just my patients or see practice-wide.
```

### Minute 2: A patient chart

```
Let's open a patient.

[Click on a patient in the inbox — ideally one with a CGM alert + abnormal lab]

You get the demographic header, then 4 metric cards: latest A1C with the trend sparkline, time-in-range from CGM, active meds, last visit.

This is the part most endos like — A1C trend chart over time, with the 7% goal line. You can see this patient was at 9.2 a year ago, now they're at 7.8. That delta shows up everywhere.
```

### Minute 3: CGM in chart

```
Scroll down. This is where the Dexcom data lives — directly in the chart, no portal-hopping.

[Scroll to GlucoseDashboard]

AGP report, time in range, mean glucose, glucose variability. You can change the range to 14, 30, 90 days. The pattern engine has flagged "recurrent nocturnal hypoglycemia" — 3 episodes below 70 in the past week, 2-4am window.

If you're an endo who's tired of switching to Clarity to see this — here it is, every visit.
```

### Minute 4: AI scribe

```
Let me show you the scribe.

[Click AI Scribe → New session for a patient]

You hit record, see the patient. When you stop, two things happen in parallel: Whisper transcribes the audio, then Claude and GPT-4o each generate a SOAP draft.

[Open a completed scribe session]

Here's the draft. Notice every line links back to a timestamp in the audio. You can replay the segment that supports any assertion. If Claude and GPT-4o disagreed on something, it's flagged for your review.

The scribe never auto-signs. You read, edit, sign. Most practices save 60-80 minutes a day.
```

### Minute 5: Inbox triage

```
Back to the inbox.

[Open /app/inbox]

The sections version groups by type. Critical CGM alerts first. Abnormal labs next. Ready scribe drafts. Unsigned encounters — ones older than 48 hours get a staleness boost.

I can bulk-acknowledge labs: select 4, click acknowledge, gone.

This is the screen that replaces 5 different views in most EHRs.
```

### Minute 6: Patient portal (optional)

Only show if they said scheduling/front-office was a pain point.

```
Last thing — patient portal.

[Open the send portal link modal on a patient]

You send a patient a magic link by SMS. They click it, no password — they're in. They can see their results, fill out a pre-visit intake form, message you for routine questions.

[Open /portal as the patient — use a magic link you generated earlier]

This is the patient view. Mobile-first. Big red emergency disclaimer at the top so it's never used for urgent stuff. Forms are dead simple.

The pre-visit intake form fires PHQ-2 depression screening, hypo episode counts, medication adherence, foot check. If anything's clinically concerning, it's flagged when you review it.
```

### Minute 7: Reports + close

```
Finally — reports.

[Open /app/reports]

Five reports: visit volume, A1C population, CGM engagement, lab gaps, revenue estimate. All exportable to CSV.

The A1C population report shows what % of your panel is at goal. Lab gaps shows who's overdue for A1C, eGFR, urine ACR per ADA guidelines.

That's the tour. What I'd love to know — was there anything I showed you that would change how you spend an hour of your week?
```

The final question is the close. Listen to their answer.

## What NOT to show

- Settings pages (boring)
- The compliance checklist (it'll look incomplete and you'll need to explain)
- The audit log (powerful but not interesting in a demo)
- The signup page (you've already signed them in)
- Anything you haven't tested

## Common demo mistakes

1. **Showing every feature.** You're not pitching the product. You're solving 2-3 specific problems they mentioned.
2. **Reading from the screen.** Have it open, talk over it.
3. **Apologizing for missing features.** "We don't have X yet" is fine — once. Don't list everything missing.
4. **Not pausing.** Stop talking every 60 seconds. Let them ask questions.
5. **Going over 10 minutes.** Hard stop at 10. If they want more, schedule a deeper demo.
6. **Not asking the close question.** "What did you think?" is weak. "What would change in your week if you had this?" is strong.
