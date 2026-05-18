-- ============================================================
-- diabetes.care — Seed remaining 4 system SOAP templates
-- ============================================================
-- Migration: 0004_seed_templates.sql
-- Adds: T1DM Follow-up, New Patient Intake, GLP-1 Initiation, CGM Review
-- (T2DM Follow-up was seeded in 0003)
-- ============================================================

insert into soap_templates (
  organization_id, slug, name, description, applies_to, encounter_types, is_system,
  subjective_template, objective_template, assessment_template, plan_template
)
values

-- ============================================================
-- T1DM Follow-up
-- ============================================================
(
  null,
  't1dm_followup',
  'T1DM Follow-up',
  'Routine follow-up for Type 1 diabetes (insulin-dependent)',
  array['type_1']::diabetes_type[],
  array['follow_up']::encounter_type[],
  true,
  '{"sections": [
    {"id": "interval_history", "label": "Interval history", "prompt": "Symptoms, DKA episodes, ER visits since last visit"},
    {"id": "insulin_regimen", "label": "Insulin regimen", "prompt": "Basal, bolus, correction factor, ICR — adherence"},
    {"id": "hypos", "label": "Hypoglycemia", "prompt": "Frequency, severity, awareness, nocturnal episodes"},
    {"id": "cgm_pump", "label": "CGM / pump use", "prompt": "Time in range, sensor wear, infusion site issues"},
    {"id": "lifestyle", "label": "Lifestyle factors", "prompt": "Exercise, stress, sleep, alcohol"}
  ]}'::jsonb,
  '{"sections": [
    {"id": "vitals", "label": "Vitals (auto-populated)", "auto": true},
    {"id": "exam", "label": "Focused exam", "prompt": "Injection / infusion sites, foot exam, BP, thyroid"},
    {"id": "labs", "label": "Recent labs", "prompt": "A1C, TIR, GMI, lipids, eGFR, urine ACR, TSH"}
  ]}'::jsonb,
  '{"sections": [
    {"id": "control_status", "label": "Glycemic control", "options": ["Excellent (TIR >70%)", "Good (TIR 60-70%)", "Fair (TIR 50-60%)", "Poor (TIR <50%)"]},
    {"id": "hypo_burden", "label": "Hypoglycemia burden", "options": ["Minimal", "Mild", "Moderate", "Severe / impaired awareness"]},
    {"id": "complications", "label": "Diabetic complications", "prompt": "Retinopathy, nephropathy, neuropathy, autonomic"}
  ]}'::jsonb,
  '{"sections": [
    {"id": "insulin_changes", "label": "Insulin adjustments", "prompt": "Basal, ICR, correction factor, target adjustments"},
    {"id": "pump_settings", "label": "Pump / CGM settings", "prompt": "Basal pattern, alerts, sensor calibration"},
    {"id": "monitoring", "label": "Monitoring", "prompt": "Next A1C, CGM review, follow-up interval"},
    {"id": "education", "label": "Education", "prompt": "Hypo management, sick day, exercise, carb counting refresh"}
  ]}'::jsonb
),

-- ============================================================
-- New Patient — Diabetes intake
-- ============================================================
(
  null,
  'new_patient_diabetes',
  'New Patient — Diabetes intake',
  'Comprehensive intake for newly-referred diabetes patient',
  array['type_1', 'type_2', 'mody', 'lada', 'gestational']::diabetes_type[],
  array['new_patient']::encounter_type[],
  true,
  '{"sections": [
    {"id": "presenting", "label": "Presenting concern", "prompt": "Why patient was referred / chief complaint"},
    {"id": "diabetes_history", "label": "Diabetes history", "prompt": "Date of diagnosis, presenting symptoms, A1C at dx, treatment course"},
    {"id": "current_meds", "label": "Current medications", "prompt": "All diabetes and non-diabetes meds with doses"},
    {"id": "complications_review", "label": "Complications review", "prompt": "Last eye exam, foot exam, kidney function, cardiac"},
    {"id": "social_history", "label": "Social history", "prompt": "Occupation, support system, insurance, food security"},
    {"id": "family_history", "label": "Family history", "prompt": "Diabetes, thyroid, autoimmune, cardiac"}
  ]}'::jsonb,
  '{"sections": [
    {"id": "vitals", "label": "Vitals (auto-populated)", "auto": true},
    {"id": "general_exam", "label": "General exam", "prompt": "HEENT, neck, cardiac, respiratory, abdomen, extremities"},
    {"id": "diabetic_exam", "label": "Diabetes-specific exam", "prompt": "Comprehensive foot exam, monofilament, fundoscopic if indicated"},
    {"id": "labs_obtained", "label": "Labs / studies", "prompt": "A1C, CMP, lipid panel, TSH, urine ACR, C-peptide if T1 suspected"}
  ]}'::jsonb,
  '{"sections": [
    {"id": "diabetes_type", "label": "Diabetes classification", "prompt": "Confirm type — T1, T2, LADA, MODY, secondary"},
    {"id": "control", "label": "Glycemic control assessment", "prompt": "Current A1C, time in range, hypo burden"},
    {"id": "complications", "label": "Complications status", "prompt": "Stage of retinopathy, nephropathy, neuropathy, ASCVD risk"},
    {"id": "comorbidities", "label": "Comorbidities", "prompt": "HTN, HLD, obesity, OSA, depression"}
  ]}'::jsonb,
  '{"sections": [
    {"id": "treatment_plan", "label": "Treatment plan", "prompt": "Medication initiation / changes, lifestyle goals, glucose targets"},
    {"id": "monitoring_plan", "label": "Monitoring", "prompt": "SMBG vs CGM, A1C frequency, follow-up cadence"},
    {"id": "referrals", "label": "Referrals", "prompt": "Ophthalmology, podiatry, dietitian, CDE, cardiology if indicated"},
    {"id": "patient_education", "label": "Education provided", "prompt": "Hypo / hyper recognition, sick day rules, foot care, carb counting"},
    {"id": "follow_up", "label": "Follow-up", "prompt": "Next visit timing, labs before next visit"}
  ]}'::jsonb
),

-- ============================================================
-- GLP-1 / GIP-GLP-1 initiation
-- ============================================================
(
  null,
  'glp1_initiation',
  'GLP-1 / GIP-GLP-1 initiation',
  'Starting semaglutide, tirzepatide, dulaglutide, or liraglutide',
  array['type_2']::diabetes_type[],
  array['medication_adjustment']::encounter_type[],
  true,
  '{"sections": [
    {"id": "rationale", "label": "Indication for GLP-1", "prompt": "Suboptimal A1C, weight loss goal, CVD risk reduction, renal protection"},
    {"id": "prior_meds", "label": "Current diabetes regimen", "prompt": "What patient is on; will continue / discontinue"},
    {"id": "contraindications", "label": "Contraindications reviewed", "prompt": "Personal/family h/o MTC, MEN2, pancreatitis, severe GI disease, gastroparesis"},
    {"id": "insurance", "label": "Insurance / cost", "prompt": "PA likely needed; alternative if denied"}
  ]}'::jsonb,
  '{"sections": [
    {"id": "vitals", "label": "Vitals (auto-populated)", "auto": true},
    {"id": "weight", "label": "Baseline weight & BMI", "prompt": "Document baseline for tracking response"},
    {"id": "labs", "label": "Recent labs", "prompt": "A1C, lipase if h/o GI, eGFR"}
  ]}'::jsonb,
  '{"sections": [
    {"id": "candidate", "label": "Candidate assessment", "prompt": "Appropriate candidate — no contraindications"},
    {"id": "expected_benefit", "label": "Expected benefit", "prompt": "A1C reduction, weight loss, CV protection if applicable"}
  ]}'::jsonb,
  '{"sections": [
    {"id": "rx", "label": "Prescription", "prompt": "Drug, starting dose, titration schedule (e.g., semaglutide 0.25mg weekly x 4w, then 0.5mg)"},
    {"id": "med_changes", "label": "Concurrent med changes", "prompt": "Reduce / d/c sulfonylurea or insulin if hypo risk; reduce basal 20%"},
    {"id": "side_effects", "label": "Side effect counseling", "prompt": "GI effects (nausea, vomiting), titrate slowly, hydration, when to call"},
    {"id": "follow_up", "label": "Follow-up plan", "prompt": "Phone check at 2 weeks, visit at 8-12 weeks for A1C reassessment"},
    {"id": "monitoring", "label": "Monitoring", "prompt": "Weight, blood pressure, glucose; lipase if symptomatic"}
  ]}'::jsonb
),

-- ============================================================
-- CGM Data Review
-- ============================================================
(
  null,
  'cgm_review',
  'CGM Data Review',
  'Focused visit for CGM data interpretation and adjustments',
  array['type_1', 'type_2']::diabetes_type[],
  array['cgm_review']::encounter_type[],
  true,
  '{"sections": [
    {"id": "patterns_noticed", "label": "Patterns patient has noticed", "prompt": "Highs / lows / times of day / activities"},
    {"id": "diet_exercise", "label": "Diet and exercise changes", "prompt": "Recent dietary or activity shifts"},
    {"id": "device_issues", "label": "Device issues", "prompt": "Sensor errors, adhesion, calibration"}
  ]}'::jsonb,
  '{"sections": [
    {"id": "tir", "label": "Time in Range (70-180)", "prompt": "% TIR over reporting period — target >70%"},
    {"id": "tar", "label": "Time Above Range", "prompt": "% time >180, >250 — patterns"},
    {"id": "tbr", "label": "Time Below Range", "prompt": "% time <70, <54 — episodes"},
    {"id": "gmi", "label": "GMI (estimated A1C)", "prompt": "Glucose Management Indicator"},
    {"id": "cv", "label": "Glucose variability (CV)", "prompt": "Target <36%"},
    {"id": "patterns", "label": "Notable patterns", "prompt": "Dawn phenomenon, postprandial spikes, nocturnal hypos"}
  ]}'::jsonb,
  '{"sections": [
    {"id": "control_assessment", "label": "Glycemic control", "options": ["Excellent (TIR >70%, low hypo)", "Good (TIR 60-70%)", "Fair (TIR 50-60%)", "Poor (TIR <50%)", "Hypoglycemia-limited"]},
    {"id": "primary_issue", "label": "Primary issue", "prompt": "What needs adjustment — basal, prandial, correction, behavior"}
  ]}'::jsonb,
  '{"sections": [
    {"id": "med_adjustments", "label": "Medication / dose adjustments", "prompt": "Specific dose changes with rationale"},
    {"id": "behavioral", "label": "Behavioral recommendations", "prompt": "Pre-meal timing, exercise routine, sleep"},
    {"id": "education", "label": "Education", "prompt": "Reviewing CGM trends, alert thresholds"},
    {"id": "follow_up", "label": "Follow-up", "prompt": "Next CGM download review, A1C check"}
  ]}'::jsonb
)
on conflict (organization_id, slug) do nothing;
