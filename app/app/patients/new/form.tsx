'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function NewPatientForm() {
  const router = useRouter();
  const [status, setStatus] = useState<'idle' | 'saving' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus('saving');
    setError(null);

    const fd = new FormData(e.currentTarget);
    const payload = Object.fromEntries(fd.entries());

    const res = await fetch('/api/patients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? 'Could not create patient.');
      setStatus('error');
      return;
    }

    const { id } = await res.json();
    router.push(`/app/patients/${id}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <fieldset className="bg-card rounded-2xl border border-border p-6 space-y-4">
        <legend className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground px-2 -ml-2">Identification</legend>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="First name" name="first_name" required />
          <Field label="Last name" name="last_name" required />
        </div>
        <div className="grid sm:grid-cols-3 gap-4">
          <Field label="MRN" name="mrn" required mono />
          <Field label="Date of birth" name="date_of_birth" type="date" required />
          <Select label="Sex at birth" name="sex_at_birth" required>
            <option value="">Select…</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
            <option value="intersex">Intersex</option>
            <option value="unknown">Unknown</option>
          </Select>
        </div>
      </fieldset>

      <fieldset className="bg-card rounded-2xl border border-border p-6 space-y-4">
        <legend className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground px-2 -ml-2">Diabetes context</legend>
        <div className="grid sm:grid-cols-2 gap-4">
          <Select label="Diabetes type" name="diabetes_type" required>
            <option value="">Select…</option>
            <option value="type_2">Type 2</option>
            <option value="type_1">Type 1</option>
            <option value="gestational">Gestational</option>
            <option value="prediabetes">Prediabetes</option>
            <option value="mody">MODY</option>
            <option value="lada">LADA</option>
            <option value="other">Other</option>
          </Select>
          <Field label="Diagnosis date" name="diagnosis_date" type="date" />
        </div>
      </fieldset>

      <fieldset className="bg-card rounded-2xl border border-border p-6 space-y-4">
        <legend className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground px-2 -ml-2">Contact</legend>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Email" name="email" type="email" />
          <Field label="Phone" name="phone" type="tel" />
        </div>
      </fieldset>

      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/30 text-destructive text-sm p-3">{error}</div>
      )}

      <div className="flex items-center justify-end gap-3">
        <button type="button" onClick={() => router.back()} className="h-10 px-5 rounded-full border border-input bg-card text-sm font-medium hover:bg-muted transition-colors">
          Cancel
        </button>
        <button type="submit" disabled={status === 'saving'} className="h-10 px-6 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-accent transition-colors disabled:opacity-50">
          {status === 'saving' ? 'Saving…' : 'Create patient'}
        </button>
      </div>
    </form>
  );
}

function Field({ label, name, type = 'text', required, mono }: { label: string; name: string; type?: string; required?: boolean; mono?: boolean }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">{label}{required && ' *'}</span>
      <input name={name} type={type} required={required}
        className={`w-full h-11 px-4 rounded-full border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring ${mono ? 'font-mono' : ''}`} />
    </label>
  );
}

function Select({ label, name, required, children }: { label: string; name: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">{label}{required && ' *'}</span>
      <select name={name} required={required} className="w-full h-11 px-4 rounded-full border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring">
        {children}
      </select>
    </label>
  );
}
