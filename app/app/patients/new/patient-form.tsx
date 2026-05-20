'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Save, Loader2, AlertCircle, Check } from 'lucide-react';

type Provider = { id: string; full_name: string; credentials: string };

export interface PatientFormProps {
  mode: 'create' | 'edit';
  initial?: any;
  providers: Provider[];
  currentUserId: string;
  suggestedMrn?: string;
  patientId?: string;
}

const DIABETES_TYPES = [
  { value: 'type_2', label: 'Type 2' },
  { value: 'type_1', label: 'Type 1' },
  { value: 'gestational', label: 'Gestational' },
  { value: 'prediabetes', label: 'Prediabetes' },
  { value: 'lada', label: 'LADA' },
  { value: 'mody', label: 'MODY' },
  { value: 'other', label: 'Other' },
];

const SEX = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
  { value: 'intersex', label: 'Intersex' },
  { value: 'unknown', label: 'Unknown' },
];

const RACE = [
  '', 'American Indian or Alaska Native', 'Asian', 'Black or African American',
  'Native Hawaiian or Other Pacific Islander', 'White', 'Other', 'Declined to specify',
];

const ETHNICITY = ['', 'Hispanic or Latino', 'Not Hispanic or Latino', 'Declined to specify'];

export function PatientForm({ mode, initial, providers, currentUserId, suggestedMrn, patientId }: PatientFormProps) {
  const router = useRouter();
  const [form, setForm] = useState({
    mrn: initial?.mrn ?? suggestedMrn ?? '',
    first_name: initial?.first_name ?? '',
    last_name: initial?.last_name ?? '',
    date_of_birth: initial?.date_of_birth ?? '',
    sex_at_birth: initial?.sex_at_birth ?? 'female',
    diabetes_type: initial?.diabetes_type ?? 'type_2',
    diagnosis_date: initial?.diagnosis_date ?? '',
    primary_provider_id: initial?.primary_provider_id ?? currentUserId,
    // Contact
    phone_mobile: initial?.phone_mobile ?? '',
    phone: initial?.phone ?? '',
    email: initial?.email ?? '',
    sms_consent: initial?.sms_consent ?? false,
    // Address
    address_line1: initial?.address_line1 ?? '',
    address_line2: initial?.address_line2 ?? '',
    city: initial?.city ?? '',
    state: initial?.state ?? '',
    postal_code: initial?.postal_code ?? '',
    // Demographics
    race: initial?.race ?? '',
    ethnicity: initial?.ethnicity ?? '',
    preferred_language: initial?.preferred_language ?? 'en',
    // Emergency contact
    emergency_contact_name: initial?.emergency_contact_name ?? '',
    emergency_contact_relationship: initial?.emergency_contact_relationship ?? '',
    emergency_contact_phone: initial?.emergency_contact_phone ?? '',
    // Insurance
    insurance_carrier: initial?.insurance_carrier ?? '',
    insurance_member_id: initial?.insurance_member_id ?? '',
    insurance_group_number: initial?.insurance_group_number ?? '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function update<K extends keyof typeof form>(k: K, v: typeof form[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit() {
    setError(null);
    setSubmitting(true);
    try {
      const url = mode === 'create' ? '/api/patients' : `/api/patients/${patientId}`;
      const method = mode === 'create' ? 'POST' : 'PATCH';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Save failed');
        return;
      }
      if (mode === 'create') {
        router.push(`/app/patients/${data.id}`);
      } else {
        setSuccess(true);
        router.refresh();
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  const valid = form.first_name && form.last_name && form.date_of_birth && form.mrn;

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); if (valid) submit(); }}
      className="space-y-5"
    >
      <Section title="Required">
        <div className="grid sm:grid-cols-3 gap-3">
          <Field label="MRN" required>
            <input value={form.mrn} onChange={(e) => update('mrn', e.target.value)} className="field-input tabular-nums" required />
          </Field>
          <Field label="Date of birth" required>
            <input type="date" value={form.date_of_birth} onChange={(e) => update('date_of_birth', e.target.value)} className="field-input tabular-nums" required />
          </Field>
          <Field label="Sex at birth" required>
            <select value={form.sex_at_birth} onChange={(e) => update('sex_at_birth', e.target.value as any)} className="field-input">
              {SEX.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </Field>
          <Field label="First name" required>
            <input value={form.first_name} onChange={(e) => update('first_name', e.target.value)} className="field-input" required autoCapitalize="words" />
          </Field>
          <Field label="Last name" required>
            <input value={form.last_name} onChange={(e) => update('last_name', e.target.value)} className="field-input" required autoCapitalize="words" />
          </Field>
          <Field label="Diabetes type" required>
            <select value={form.diabetes_type} onChange={(e) => update('diabetes_type', e.target.value as any)} className="field-input">
              {DIABETES_TYPES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
          </Field>
          <Field label="Diagnosis date (optional)">
            <input type="date" value={form.diagnosis_date} onChange={(e) => update('diagnosis_date', e.target.value)} className="field-input tabular-nums" />
          </Field>
          <Field label="Primary provider">
            <select value={form.primary_provider_id} onChange={(e) => update('primary_provider_id', e.target.value)} className="field-input">
              {providers.map((p) => <option key={p.id} value={p.id}>{p.full_name}{p.credentials ? `, ${p.credentials}` : ''}</option>)}
            </select>
          </Field>
        </div>
      </Section>

      <Section title="Contact & consent">
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Mobile phone (for SMS)">
            <input type="tel" value={form.phone_mobile} onChange={(e) => update('phone_mobile', e.target.value)} placeholder="(555) 123-4567" className="field-input" />
          </Field>
          <Field label="Other phone">
            <input type="tel" value={form.phone} onChange={(e) => update('phone', e.target.value)} className="field-input" />
          </Field>
          <Field label="Email">
            <input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} className="field-input" />
          </Field>
          <Field label="Preferred language">
            <select value={form.preferred_language} onChange={(e) => update('preferred_language', e.target.value)} className="field-input">
              <option value="en">English</option>
              <option value="es">Spanish</option>
              <option value="fr">French</option>
              <option value="zh">Chinese</option>
              <option value="ar">Arabic</option>
              <option value="vi">Vietnamese</option>
              <option value="other">Other</option>
            </select>
          </Field>
        </div>
        <label className="flex items-start gap-3 mt-3 p-3 rounded-lg border border-input cursor-pointer hover:bg-muted/30 transition-colors">
          <input
            type="checkbox"
            checked={form.sms_consent}
            onChange={(e) => update('sms_consent', e.target.checked)}
            className="mt-1 rounded"
            disabled={!form.phone_mobile}
          />
          <div className="flex-1">
            <div className="font-medium text-sm">
              Patient consents to receive SMS appointment reminders
              {!form.phone_mobile && <span className="text-xs text-muted-foreground ml-2">(add mobile phone first)</span>}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Required before any reminders can be sent. Patients can opt out at any time by replying STOP.
            </div>
          </div>
        </label>
      </Section>

      <Section title="Address" collapsible>
        <div className="space-y-3">
          <Field label="Street">
            <input value={form.address_line1} onChange={(e) => update('address_line1', e.target.value)} className="field-input" />
          </Field>
          <Field label="Apt / suite">
            <input value={form.address_line2} onChange={(e) => update('address_line2', e.target.value)} className="field-input" />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="City">
              <input value={form.city} onChange={(e) => update('city', e.target.value)} className="field-input" />
            </Field>
            <Field label="State">
              <input value={form.state} onChange={(e) => update('state', e.target.value.toUpperCase().slice(0, 2))} className="field-input uppercase" maxLength={2} />
            </Field>
            <Field label="ZIP">
              <input value={form.postal_code} onChange={(e) => update('postal_code', e.target.value)} className="field-input tabular-nums" />
            </Field>
          </div>
        </div>
      </Section>

      <Section title="Demographics (USCDI)" collapsible>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Race">
            <select value={form.race} onChange={(e) => update('race', e.target.value)} className="field-input">
              {RACE.map((r) => <option key={r} value={r}>{r || 'Select…'}</option>)}
            </select>
          </Field>
          <Field label="Ethnicity">
            <select value={form.ethnicity} onChange={(e) => update('ethnicity', e.target.value)} className="field-input">
              {ETHNICITY.map((e) => <option key={e} value={e}>{e || 'Select…'}</option>)}
            </select>
          </Field>
        </div>
      </Section>

      <Section title="Emergency contact" collapsible>
        <div className="grid sm:grid-cols-3 gap-3">
          <Field label="Name">
            <input value={form.emergency_contact_name} onChange={(e) => update('emergency_contact_name', e.target.value)} className="field-input" />
          </Field>
          <Field label="Relationship">
            <input value={form.emergency_contact_relationship} onChange={(e) => update('emergency_contact_relationship', e.target.value)} placeholder="spouse, parent…" className="field-input" />
          </Field>
          <Field label="Phone">
            <input type="tel" value={form.emergency_contact_phone} onChange={(e) => update('emergency_contact_phone', e.target.value)} className="field-input" />
          </Field>
        </div>
      </Section>

      <Section title="Insurance" collapsible>
        <div className="grid sm:grid-cols-3 gap-3">
          <Field label="Carrier">
            <input value={form.insurance_carrier} onChange={(e) => update('insurance_carrier', e.target.value)} className="field-input" />
          </Field>
          <Field label="Member ID">
            <input value={form.insurance_member_id} onChange={(e) => update('insurance_member_id', e.target.value)} className="field-input" />
          </Field>
          <Field label="Group #">
            <input value={form.insurance_group_number} onChange={(e) => update('insurance_group_number', e.target.value)} className="field-input" />
          </Field>
        </div>
      </Section>

      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm p-3 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" /><span>{error}</span>
        </div>
      )}
      {success && mode === 'edit' && (
        <div className="rounded-lg bg-green-50 dark:bg-green-950 border border-green-300 dark:border-green-800 text-green-900 dark:text-green-100 text-sm p-3 flex items-center gap-2">
          <Check className="h-4 w-4" /> Patient updated
        </div>
      )}

      <div className="flex items-center justify-end gap-3 sticky bottom-0 bg-background/95 backdrop-blur py-3 -mx-2 px-2 border-t border-border">
        <button
          type="button"
          onClick={() => router.back()}
          className="h-10 px-5 rounded-full border border-input bg-card text-sm font-medium hover:bg-muted transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!valid || submitting}
          className="inline-flex items-center gap-2 h-10 px-6 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-accent transition-colors disabled:opacity-50"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {mode === 'create' ? 'Create patient' : 'Save changes'}
        </button>
      </div>

      <style jsx>{`
        :global(.field-input) {
          width: 100%; height: 40px; padding: 0 12px;
          border-radius: 8px;
          border: 1px solid hsl(var(--input));
          background: hsl(var(--background));
          font-size: 14px;
        }
        :global(.field-input:focus) {
          outline: 2px solid hsl(var(--ring));
          outline-offset: -1px;
        }
      `}</style>
    </form>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}{required && <span className="text-destructive ml-1">*</span>}
      </div>
      {children}
    </label>
  );
}

function Section({ title, children, collapsible }: { title: string; children: React.ReactNode; collapsible?: boolean }) {
  const [open, setOpen] = useState(!collapsible);
  if (!collapsible) {
    return (
      <section className="bg-card rounded-2xl border border-border p-5 space-y-3">
        <h2 className="font-display text-lg">{title}</h2>
        {children}
      </section>
    );
  }
  return (
    <section className="bg-card rounded-2xl border border-border">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-muted/30 transition-colors text-left"
      >
        <h2 className="font-display text-lg">{title}</h2>
        <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">{open ? 'Collapse' : 'Expand'}</span>
      </button>
      {open && <div className="px-5 pb-5 space-y-3">{children}</div>}
    </section>
  );
}
