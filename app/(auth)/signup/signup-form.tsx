'use client';

import { useState } from 'react';

export function SignupForm() {
  const [form, setForm] = useState({ fullName: '', email: '', practiceName: '', npi: '' });
  const [status, setStatus] = useState<'idle' | 'submitting' | 'sent' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('submitting');
    setError(null);

    const res = await fetch('/api/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? 'Signup failed. Please try again.');
      setStatus('error');
      return;
    }
    setStatus('sent');
  }

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  if (status === 'sent') {
    return (
      <div className="rounded-xl border border-border bg-card p-6 space-y-3 text-center">
        <div className="font-display text-xl">Almost there</div>
        <p className="text-sm text-muted-foreground">
          We sent a sign-in link to <strong className="text-foreground">{form.email}</strong>. Click it to finish setting up <strong className="text-foreground">{form.practiceName}</strong>.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field id="fullName" label="Your name">
        <input id="fullName" required value={form.fullName} onChange={(e) => update('fullName', e.target.value)}
          className="w-full h-11 px-4 rounded-full border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
      </Field>
      <Field id="email" label="Work email">
        <input id="email" type="email" required autoComplete="email" value={form.email} onChange={(e) => update('email', e.target.value)}
          className="w-full h-11 px-4 rounded-full border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
      </Field>
      <Field id="practiceName" label="Practice name">
        <input id="practiceName" required value={form.practiceName} onChange={(e) => update('practiceName', e.target.value)}
          placeholder="Chen Endocrinology Associates"
          className="w-full h-11 px-4 rounded-full border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
      </Field>
      <Field id="npi" label="Your NPI (optional)">
        <input id="npi" value={form.npi} onChange={(e) => update('npi', e.target.value)} placeholder="1234567890" pattern="\d{10}"
          className="w-full h-11 px-4 rounded-full border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring font-mono" />
      </Field>
      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/30 text-destructive text-sm p-3">{error}</div>
      )}
      <button type="submit" disabled={status === 'submitting'}
        className="w-full h-11 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-accent transition-colors disabled:opacity-50">
        {status === 'submitting' ? 'Creating practice…' : 'Create practice & send sign-in link'}
      </button>
      <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
        By signing up you agree to our Terms of Service and Privacy Policy. We&rsquo;ll sign a BAA before you load any patient data.
      </p>
    </form>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium">{label}</label>
      {children}
    </div>
  );
}
