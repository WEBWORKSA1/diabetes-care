/**
 * Default intake form templates seeded for new organizations.
 */

export interface IntakeField {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'select' | 'radio' | 'checkbox' | 'date' | 'scale';
  required?: boolean;
  options?: string[];
  scale_min?: number;
  scale_max?: number;
  scale_min_label?: string;
  scale_max_label?: string;
  help_text?: string;
  placeholder?: string;
}

export const DEFAULT_PRE_VISIT_FORM: { name: string; kind: 'pre_visit'; description: string; fields: IntakeField[] } = {
  name: 'Pre-visit check-in (Diabetes follow-up)',
  kind: 'pre_visit',
  description: 'A few quick questions before your appointment.',
  fields: [
    {
      id: 'symptoms_since_last',
      label: 'Have you had any new symptoms since your last visit?',
      type: 'textarea',
      required: false,
      placeholder: 'For example: thirst, fatigue, blurred vision, frequent urination, foot tingling, dizziness…',
    },
    {
      id: 'hypo_episodes',
      label: 'In the past 2 weeks, how many low blood sugar episodes have you had (below 70 mg/dL)?',
      type: 'select',
      required: true,
      options: ['None', '1–2', '3–5', '6+ — happens often'],
    },
    {
      id: 'hypo_severe',
      label: 'Did any low blood sugar episode require help from another person, or cause confusion or loss of consciousness?',
      type: 'radio',
      required: true,
      options: ['No', 'Yes'],
    },
    {
      id: 'medication_adherence',
      label: 'How often have you taken your diabetes medications as prescribed in the past 2 weeks?',
      type: 'select',
      required: true,
      options: ['Every dose', 'Missed 1–2 doses', 'Missed several doses', 'Stopped taking it', 'I don’t remember'],
    },
    {
      id: 'medication_changes',
      label: 'Have any of your medications changed since your last visit? (New, stopped, dose changes, including non-diabetes meds.)',
      type: 'textarea',
      required: false,
      placeholder: 'List any changes or write "no changes"',
    },
    {
      id: 'glp1_side_effects',
      label: 'If you are on a GLP-1 (Ozempic, Wegovy, Mounjaro, Trulicity, etc.), have you had nausea, vomiting, severe constipation, or stomach pain?',
      type: 'radio',
      required: false,
      options: ['Not on a GLP-1', 'No', 'Mild', 'Moderate', 'Severe — had to stop'],
    },
    {
      id: 'cgm_use',
      label: 'Do you use a continuous glucose monitor (CGM)?',
      type: 'radio',
      required: true,
      options: ['No', 'Yes — Dexcom', 'Yes — Libre', 'Yes — other'],
    },
    {
      id: 'foot_check',
      label: 'Have you noticed any sores, blisters, color changes, or numbness in your feet?',
      type: 'radio',
      required: true,
      options: ['No', 'Yes — healing well', 'Yes — new or not healing'],
    },
    {
      id: 'mood',
      label: 'How often in the past 2 weeks have you felt down, depressed, or hopeless? (PHQ-2 #1)',
      type: 'scale',
      required: true,
      scale_min: 0,
      scale_max: 3,
      scale_min_label: 'Not at all',
      scale_max_label: 'Nearly every day',
    },
    {
      id: 'interest',
      label: 'How often in the past 2 weeks have you had little interest or pleasure in doing things? (PHQ-2 #2)',
      type: 'scale',
      required: true,
      scale_min: 0,
      scale_max: 3,
      scale_min_label: 'Not at all',
      scale_max_label: 'Nearly every day',
    },
    {
      id: 'questions_for_provider',
      label: 'What do you most want to ask or discuss with your provider today?',
      type: 'textarea',
      required: false,
      placeholder: 'Anything on your mind — we want to make sure we cover it.',
    },
  ],
};

export const DEFAULT_FORMS = [DEFAULT_PRE_VISIT_FORM];
