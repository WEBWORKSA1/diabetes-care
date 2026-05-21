#!/usr/bin/env node
/**
 * Demo seed script.
 *
 * Generates a realistic-looking practice:
 *   * 30 patients across diabetes types, ages, A1C bands
 *   * 6 months of CGM data for ~half
 *   * Lab history (A1C, lipids, kidney) per patient
 *   * Scheduled visits for next 2 weeks + completed visits last 90 days
 *   * A few unsigned encounters + ready scribe drafts (for inbox)
 *   * Some abnormal labs + critical CGM alerts (for inbox)
 *   * 2-3 pending intake forms
 *
 * Usage:
 *   npm install
 *   DATABASE_URL=... npm run seed:demo -- --org-id=<uuid> --provider-id=<uuid>
 *
 * Or:
 *   npm run seed:demo -- --signup
 *     (creates a demo org + owner first, prints credentials)
 */

import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

// ----- Config -----

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Parse CLI args
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  })
);

// ----- Realistic data pools -----

const FIRST_NAMES_F = ['Maria', 'Patricia', 'Linda', 'Barbara', 'Susan', 'Jessica', 'Sarah', 'Karen', 'Nancy', 'Lisa', 'Margaret', 'Sandra', 'Ashley', 'Kimberly', 'Donna', 'Emily', 'Michelle', 'Carol', 'Amanda', 'Melissa'];
const FIRST_NAMES_M = ['James', 'Robert', 'John', 'Michael', 'David', 'William', 'Richard', 'Charles', 'Thomas', 'Daniel', 'Matthew', 'Anthony', 'Mark', 'Donald', 'Steven', 'Paul', 'Andrew', 'Kenneth', 'Joshua', 'Kevin'];
const LAST_NAMES = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson'];
const CITIES = [
  { city: 'Brooklyn', state: 'NY', zip: '11201' },
  { city: 'Houston', state: 'TX', zip: '77002' },
  { city: 'Phoenix', state: 'AZ', zip: '85001' },
  { city: 'Chicago', state: 'IL', zip: '60601' },
  { city: 'Atlanta', state: 'GA', zip: '30301' },
  { city: 'Miami', state: 'FL', zip: '33101' },
];
const REASONS_FOLLOWUP = ['Diabetes follow-up', 'CGM review', 'GLP-1 check-in', 'A1C re-check', 'Insulin titration', 'Med refill + review', 'Annual diabetes visit'];
const CHIEF_COMPLAINTS = ['Diabetes follow-up', 'Elevated A1C', 'Glucose variability', 'Med adjustment', 'Weight management', 'Foot tingling', 'GLP-1 side effects'];

// Distribution targets (out of 30):
//   T2DM 22, T1DM 5, Prediabetes 3
//   A1C bands: very_high 4, high 6, borderline 8, at_goal 9, normal 3
const PATIENT_TEMPLATES = [
  ...repeat(4, { type: 'type_2', band: 'very_high' }),  // 9.0+
  ...repeat(6, { type: 'type_2', band: 'high' }),       // 8.0-8.9
  ...repeat(6, { type: 'type_2', band: 'borderline' }), // 7.0-7.9
  ...repeat(6, { type: 'type_2', band: 'at_goal' }),    // 5.7-6.9
  ...repeat(2, { type: 'type_1', band: 'high' }),
  ...repeat(3, { type: 'type_1', band: 'borderline' }),
  ...repeat(3, { type: 'prediabetes', band: 'normal' }),
];

function repeat<T>(n: number, v: T): T[] { return Array.from({ length: n }, () => v); }
function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function randint(lo: number, hi: number): number { return Math.floor(Math.random() * (hi - lo + 1)) + lo; }
function randfloat(lo: number, hi: number, decimals = 1): number { return Number((Math.random() * (hi - lo) + lo).toFixed(decimals)); }
function daysAgo(d: number): Date { return new Date(Date.now() - d * 86400000); }
function monthsAgo(m: number): Date { const d = new Date(); d.setMonth(d.getMonth() - m); return d; }
function iso(d: Date): string { return d.toISOString(); }
function dateOnly(d: Date): string { return d.toISOString().slice(0, 10); }

function a1cForBand(band: string): number {
  switch (band) {
    case 'normal': return randfloat(4.8, 5.6);
    case 'at_goal': return randfloat(5.8, 6.9);
    case 'borderline': return randfloat(7.0, 7.9);
    case 'high': return randfloat(8.0, 8.9);
    case 'very_high': return randfloat(9.1, 11.5);
    default: return 7.0;
  }
}

function meanGlucoseForA1C(a1c: number): number {
  // ADAG equation: eAG = 28.7 * A1C - 46.7
  return Math.round(28.7 * a1c - 46.7);
}

// ----- Main -----

async function main() {
  let orgId = args['org-id'] as string | undefined;
  let providerId = args['provider-id'] as string | undefined;

  if (args.signup || (!orgId && !providerId)) {
    const created = await createDemoOrg();
    orgId = created.orgId;
    providerId = created.providerId;
  }

  if (!orgId || !providerId) {
    console.error('Need --org-id and --provider-id (or --signup to create a fresh demo practice).');
    process.exit(1);
  }

  console.log(`\n⚡ Seeding demo data for org ${orgId}, provider ${providerId}\n`);

  // 1. Availability for the provider (Mon-Fri 9-5)
  await seedAvailability(orgId, providerId);
  console.log('  ✓ Provider availability (M-F 9-5)');

  // 2. Patients
  const patients = [];
  for (let i = 0; i < PATIENT_TEMPLATES.length; i++) {
    const t = PATIENT_TEMPLATES[i];
    const p = await createPatient(orgId, providerId, i, t.type, t.band);
    patients.push(p);
  }
  console.log(`  ✓ ${patients.length} patients`);

  // 3. Lab history per patient
  for (const p of patients) {
    await seedLabsFor(orgId, p);
  }
  console.log(`  ✓ Lab history (A1C trends, lipids, kidney)`);

  // 4. CGM connections + readings for half
  const cgmPatients = patients.filter((_, i) => i % 2 === 0).slice(0, 15);
  for (const p of cgmPatients) {
    await seedCgmFor(orgId, p);
  }
  console.log(`  ✓ ${cgmPatients.length} CGM connections + 30-day reading streams`);

  // 5. Appointments (past + upcoming)
  for (const p of patients) {
    await seedAppointmentsFor(orgId, providerId, p);
  }
  console.log(`  ✓ Appointments (past 90d + next 14d)`);

  // 6. Some unsigned encounters (for inbox demo)
  for (let i = 0; i < 4; i++) {
    await seedUnsignedEncounter(orgId, providerId, patients[i]);
  }
  console.log(`  ✓ 4 unsigned encounters (inbox demo)`);

  // 7. Critical CGM alerts (for inbox demo)
  await seedCgmAlerts(orgId, cgmPatients.slice(0, 3));
  console.log(`  ✓ 3 CGM alerts (1 critical)`);

  // 8. Pending intake form responses (for inbox demo)
  await seedIntakeResponses(orgId, patients.slice(0, 3));
  console.log(`  ✓ 3 submitted intake forms`);

  // 9. Mark onboarding as complete
  await supabase.from('onboarding_state').upsert({
    organization_id: orgId,
    practice_profile_complete: true,
    availability_set: true,
    first_patient_added: true,
    sms_configured: false,
    scribe_tested: false,
  }, { onConflict: 'organization_id' });

  console.log(`\n✅ Done. Sign in to your demo practice and visit /app.\n`);
}

// ----- Helpers -----

async function createDemoOrg() {
  const email = `demo+${Date.now()}@diabetes.care`;
  const password = 'Demo' + randint(1000, 9999) + '!';

  const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: { full_name: 'Dr. Jane Smith' },
  });
  if (authErr || !authUser?.user) throw new Error('Failed to create auth user: ' + authErr?.message);

  const trialEnd = new Date(); trialEnd.setDate(trialEnd.getDate() + 30);

  const { data: org, error: orgErr } = await supabase
    .from('organizations')
    .insert({
      name: 'Pinecrest Endocrinology Demo',
      phone: '(555) 123-4567',
      timezone: 'America/New_York',
      plan: 'trial',
      trial_ends_at: trialEnd.toISOString(),
      sms_from_name: 'Pinecrest Endo',
    })
    .select('id')
    .single();
  if (orgErr || !org) throw new Error('Failed to create org: ' + orgErr?.message);

  const { error: profileErr } = await supabase.from('users').insert({
    id: authUser.user.id,
    organization_id: org.id,
    email,
    full_name: 'Dr. Jane Smith',
    credentials: 'MD',
    role: 'owner',
    is_active: true,
  });
  if (profileErr) throw new Error('Failed to create profile: ' + profileErr.message);

  console.log('\n🆕 Created demo practice');
  console.log(`    URL:      ${SUPABASE_URL?.replace('https://', 'https://app.')}`);
  console.log(`    Email:    ${email}`);
  console.log(`    Password: ${password}`);
  console.log(`    Org ID:   ${org.id}`);
  console.log(`    User ID:  ${authUser.user.id}\n`);

  return { orgId: org.id, providerId: authUser.user.id };
}

async function seedAvailability(orgId: string, providerId: string) {
  const rows = [1, 2, 3, 4, 5].map((day) => ({
    organization_id: orgId,
    provider_id: providerId,
    day_of_week: day,
    start_time: '09:00',
    end_time: '17:00',
    slot_duration_minutes: 30,
    is_active: true,
  }));
  await supabase.from('provider_availability').insert(rows);
}

async function createPatient(orgId: string, providerId: string, idx: number, type: string, band: string) {
  const sex = Math.random() > 0.5 ? 'female' : 'male';
  const firstName = pick(sex === 'female' ? FIRST_NAMES_F : FIRST_NAMES_M);
  const lastName = pick(LAST_NAMES);
  const city = pick(CITIES);
  const age = type === 'type_1' ? randint(18, 45) : type === 'prediabetes' ? randint(35, 60) : randint(40, 75);
  const dob = new Date(); dob.setFullYear(dob.getFullYear() - age); dob.setMonth(randint(0, 11)); dob.setDate(randint(1, 28));
  const dxYearsAgo = type === 'type_1' ? randint(5, 25) : type === 'prediabetes' ? randint(1, 3) : randint(2, 15);
  const dxDate = new Date(); dxDate.setFullYear(dxDate.getFullYear() - dxYearsAgo);
  const mrn = String(idx + 1).padStart(4, '0');
  const hasSmsConsent = Math.random() > 0.2;

  const { data, error } = await supabase
    .from('patients')
    .insert({
      organization_id: orgId,
      primary_provider_id: providerId,
      mrn,
      first_name: firstName,
      last_name: lastName,
      date_of_birth: dateOnly(dob),
      sex_at_birth: sex,
      diabetes_type: type,
      diagnosis_date: dateOnly(dxDate),
      phone_mobile: `(${randint(200, 999)}) ${randint(200, 999)}-${randint(1000, 9999)}`,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`,
      sms_consent: hasSmsConsent,
      sms_consent_at: hasSmsConsent ? iso(daysAgo(randint(30, 365))) : null,
      address_line1: `${randint(100, 9999)} ${pick(['Main', 'Oak', 'Maple', 'Elm', 'Park'])} ${pick(['St', 'Ave', 'Rd'])}`,
      city: city.city,
      state: city.state,
      postal_code: city.zip,
      country: 'US',
      is_active: true,
    })
    .select('id')
    .single();
  if (error) throw new Error(`Patient insert failed: ${error.message}`);

  return { id: data!.id, mrn, type, band, firstName, lastName };
}

async function seedLabsFor(orgId: string, p: any) {
  // A1C trend: 4 historical, latest matches the target band
  const trendMonths = [12, 9, 6, 3, 0];
  const finalA1c = a1cForBand(p.band);
  // Start slightly worse than current, drift to current
  const startA1c = Math.min(11.5, finalA1c + randfloat(0.3, 1.2));
  const rows = [];

  for (let i = 0; i < trendMonths.length; i++) {
    const v = startA1c + (finalA1c - startA1c) * (i / (trendMonths.length - 1));
    rows.push({
      organization_id: orgId,
      patient_id: p.id,
      test_name: 'a1c',
      value: Number(v.toFixed(1)),
      unit: '%',
      collected_at: iso(monthsAgo(trendMonths[i])),
      reference_low: 4.0,
      reference_high: 5.7,
      source: 'manual',
      // Latest is intentionally unreviewed for the inbox demo
      reviewed_at: i < trendMonths.length - 1 ? iso(daysAgo(trendMonths[i] * 30 - 2)) : null,
    });
  }

  // Lipids (annual)
  rows.push(
    { organization_id: orgId, patient_id: p.id, test_name: 'ldl', value: randint(60, 160), unit: 'mg/dL', collected_at: iso(monthsAgo(randint(2, 10))), reference_low: 0, reference_high: 100, source: 'manual' },
    { organization_id: orgId, patient_id: p.id, test_name: 'hdl', value: randint(30, 75), unit: 'mg/dL', collected_at: iso(monthsAgo(randint(2, 10))), reference_low: 40, reference_high: 999, source: 'manual' },
    { organization_id: orgId, patient_id: p.id, test_name: 'triglycerides', value: randint(80, 250), unit: 'mg/dL', collected_at: iso(monthsAgo(randint(2, 10))), reference_low: 0, reference_high: 150, source: 'manual' }
  );

  // Kidney function (yearly per ADA); skip for prediabetes
  if (p.type !== 'prediabetes') {
    // 70% have recent eGFR/ACR, 30% have a gap (for the lab-gaps report demo)
    if (Math.random() > 0.3) {
      rows.push(
        { organization_id: orgId, patient_id: p.id, test_name: 'egfr', value: randint(50, 110), unit: 'mL/min/1.73m²', collected_at: iso(monthsAgo(randint(3, 11))), reference_low: 60, reference_high: 999, source: 'manual' },
        { organization_id: orgId, patient_id: p.id, test_name: 'urine_acr', value: randint(5, 80), unit: 'mg/g', collected_at: iso(monthsAgo(randint(3, 11))), reference_low: 0, reference_high: 30, source: 'manual' }
      );
    }
  }

  await supabase.from('lab_values').insert(rows);
}

async function seedCgmFor(orgId: string, p: any) {
  // CGM connection
  await supabase.from('cgm_connections').insert({
    organization_id: orgId,
    patient_id: p.id,
    device: pick(['dexcom_g7', 'dexcom_g6']),
    is_active: true,
    last_synced_at: iso(daysAgo(randint(0, 2))),
    token_expires_at: iso(daysAgo(-30)),
    access_token_encrypted: 'demo_encrypted_token',
    refresh_token_encrypted: 'demo_encrypted_refresh',
    sync_status: 'active',
    consecutive_failures: 0,
  });

  // 30 days of readings (every 5 min = 8640 readings; we'll do every 15 min = 2880 for speed)
  const finalA1c = a1cForBand(p.band);
  const targetMean = meanGlucoseForA1C(finalA1c);
  const stdDev = p.type === 'type_1' ? 55 : 35;

  const readings: any[] = [];
  const now = Date.now();
  for (let mins = 30 * 24 * 60; mins >= 0; mins -= 15) {
    const t = new Date(now - mins * 60 * 1000);
    const hr = t.getHours();
    // Slight circadian pattern: dawn rise (4-7am), postprandial spikes (8, 13, 19)
    const dawnBoost = hr >= 4 && hr <= 7 ? 15 : 0;
    const mealHourSpike = [8, 13, 19].includes(hr) ? randint(20, 60) : 0;
    const noise = (Math.random() - 0.5) * stdDev;
    const glucose = Math.max(50, Math.min(350, Math.round(targetMean + dawnBoost + mealHourSpike + noise)));
    readings.push({
      organization_id: orgId,
      patient_id: p.id,
      recorded_at: iso(t),
      glucose_mg_dl: glucose,
      trend: pick(['flat', 'rising', 'falling', 'rising_quickly', 'falling_quickly']),
      source: 'dexcom',
    });
  }

  // Batch insert (1000 at a time)
  for (let i = 0; i < readings.length; i += 1000) {
    await supabase.from('cgm_readings').insert(readings.slice(i, i + 1000));
  }
}

async function seedAppointmentsFor(orgId: string, providerId: string, p: any) {
  // 1-2 past completed visits in last 90 days
  const pastCount = randint(1, 2);
  for (let i = 0; i < pastCount; i++) {
    const d = daysAgo(randint(7, 85));
    d.setHours(randint(9, 16), [0, 30][randint(0, 1)], 0, 0);
    const end = new Date(d.getTime() + 30 * 60000);
    await supabase.from('appointments').insert({
      organization_id: orgId,
      patient_id: p.id,
      provider_id: providerId,
      starts_at: iso(d),
      ends_at: iso(end),
      timezone: 'America/New_York',
      appointment_type: pick(['follow_up', 'cgm_review', 'lab_review']),
      reason: pick(REASONS_FOLLOWUP),
      status: pick(['completed', 'completed', 'completed', 'no_show']),
      arrived_at: iso(d),
      started_at: iso(d),
      completed_at: iso(end),
    });
  }

  // 30% get a future appointment in next 14 days
  if (Math.random() < 0.3) {
    const d = new Date(); d.setDate(d.getDate() + randint(1, 14));
    d.setHours(randint(9, 16), [0, 30][randint(0, 1)], 0, 0);
    const end = new Date(d.getTime() + 30 * 60000);
    await supabase.from('appointments').insert({
      organization_id: orgId,
      patient_id: p.id,
      provider_id: providerId,
      starts_at: iso(d),
      ends_at: iso(end),
      timezone: 'America/New_York',
      appointment_type: pick(['follow_up', 'cgm_review', 'glp1_initiation']),
      reason: pick(REASONS_FOLLOWUP),
      status: pick(['scheduled', 'confirmed']),
    });
  }
}

async function seedUnsignedEncounter(orgId: string, providerId: string, p: any) {
  const start = daysAgo(randint(1, 3));
  start.setHours(randint(9, 16), 0, 0, 0);
  await supabase.from('encounters').insert({
    organization_id: orgId,
    patient_id: p.id,
    provider_id: providerId,
    encounter_type: 'follow_up',
    status: 'in_progress',
    scheduled_at: iso(start),
    started_at: iso(start),
    chief_complaint: pick(CHIEF_COMPLAINTS),
    subjective: 'Patient reports compliance with metformin 1000mg BID. Denies hypoglycemic episodes. Following plate-method diet, walking 20 min daily.',
    objective: 'Vitals stable. Weight unchanged from prior visit. Foot exam: pedal pulses 2+, no lesions, monofilament intact.',
    assessment: `T2DM with recent A1C trending toward target. ${pick(['Continue current regimen.', 'Consider GLP-1 initiation.', 'Optimize lipids.'])}`,
    plan: '1. Continue current meds. 2. Repeat A1C in 3 months. 3. Annual eye/foot exam reminder. 4. RTC in 3 months.',
  });
}

async function seedCgmAlerts(orgId: string, patients: any[]) {
  const alerts = [
    { severity: 'critical', alert_type: 'severe_hypoglycemia', title: 'Severe hypo: glucose dropped to 48 mg/dL', description: 'Sustained reading below 54 for 18 minutes overnight' },
    { severity: 'warning', alert_type: 'nocturnal_hypoglycemia', title: 'Recurrent nocturnal hypoglycemia', description: '3 episodes below 70 in past 7 nights, 2-4am window' },
    { severity: 'warning', alert_type: 'dawn_phenomenon', title: 'Dawn phenomenon pattern detected', description: 'Mean fasting glucose rose 35 mg/dL between 4am-7am over last 14 days' },
  ];
  for (let i = 0; i < patients.length && i < alerts.length; i++) {
    const a = alerts[i];
    await supabase.from('cgm_alerts').insert({
      organization_id: orgId,
      patient_id: patients[i].id,
      severity: a.severity,
      alert_type: a.alert_type,
      title: a.title,
      description: a.description,
      detected_at: iso(daysAgo(randint(0, 2))),
      observation_window_start: iso(daysAgo(7)),
      observation_window_end: iso(daysAgo(0)),
      context: { sample_readings: [], confidence: 0.85 },
    });
  }
}

async function seedIntakeResponses(orgId: string, patients: any[]) {
  // Get or create the default pre-visit form for this org
  let { data: form } = await supabase
    .from('intake_forms')
    .select('id, fields')
    .eq('organization_id', orgId)
    .eq('kind', 'pre_visit')
    .maybeSingle();

  if (!form) {
    const { data: created } = await supabase
      .from('intake_forms')
      .insert({
        organization_id: orgId,
        name: 'Pre-visit check-in (Diabetes follow-up)',
        kind: 'pre_visit',
        description: 'A few quick questions before your appointment.',
        fields: [
          { id: 'hypo_episodes', label: 'Low blood sugar episodes (past 2 weeks)', type: 'select', required: true, options: ['None', '1–2', '3–5', '6+ — happens often'] },
          { id: 'hypo_severe', label: 'Severe hypo with help needed?', type: 'radio', required: true, options: ['No', 'Yes'] },
          { id: 'medication_adherence', label: 'Medication adherence', type: 'select', required: true, options: ['Every dose', 'Missed 1–2 doses', 'Missed several doses', 'Stopped taking it'] },
          { id: 'foot_check', label: 'Foot check', type: 'radio', required: true, options: ['No', 'Yes — healing well', 'Yes — new or not healing'] },
          { id: 'mood', label: 'PHQ-2 mood', type: 'scale', required: true, scale_min: 0, scale_max: 3 },
          { id: 'interest', label: 'PHQ-2 interest', type: 'scale', required: true, scale_min: 0, scale_max: 3 },
        ],
        is_active: true,
      })
      .select('id, fields')
      .single();
    form = created!;
  }

  const responseScenarios = [
    // Scenario 1: routine
    { hypo_episodes: 'None', hypo_severe: 'No', medication_adherence: 'Every dose', foot_check: 'No', mood: 0, interest: 0 },
    // Scenario 2: PHQ-2 flagged + adherence concern
    { hypo_episodes: '1–2', hypo_severe: 'No', medication_adherence: 'Missed several doses', foot_check: 'No', mood: 2, interest: 2 },
    // Scenario 3: severe hypo + foot wound
    { hypo_episodes: '3–5', hypo_severe: 'Yes', medication_adherence: 'Every dose', foot_check: 'Yes — new or not healing', mood: 1, interest: 0 },
  ];

  for (let i = 0; i < patients.length && i < responseScenarios.length; i++) {
    await supabase.from('intake_form_responses').insert({
      organization_id: orgId,
      intake_form_id: form!.id,
      patient_id: patients[i].id,
      status: 'submitted',
      responses: responseScenarios[i],
      sent_at: iso(daysAgo(3)),
      started_at: iso(daysAgo(2)),
      submitted_at: iso(daysAgo(randint(0, 2))),
      access_token: randomUUID(),
    });
  }
}

main().catch((err) => {
  console.error('\n❌ Seed failed:', err);
  process.exit(1);
});
