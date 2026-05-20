'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2, AlertCircle, ArrowRight } from 'lucide-react';
import { createBrowserClient } from '@supabase/ssr';

export function SignupForm() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    practice_name: '',
    practice_phone: '',
    practice_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York',
    full_name: '',
    credentials: '',
    npi: '',
    email: '',
    password: '',
  });

  function update(k: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function step1Valid() {
    return form.practice_name.trim().length >= 2;
  }

  async function submit() {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Signup failed');
        return;
      }

      // Auto sign-in after signup
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
      const supabase = createBrowserClient(supabaseUrl, supabaseKey);
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: form.email,
        password: form.password,
      });
      if (signInErr) {
        // Account was created but auto-signin failed; send to login
        router.push('/login?signup=success');
        return;
      }

      router.push('/app?welcome=1');
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (step === 1 && step1Valid()) {
          setStep(2);
        } else if (step === 2) {
          submit();
        }
      }}
      className="space-y-4"
    >
      <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider">
        <span className={step === 1 ? 'text-foreground' : 'text-green-700 dark:text-green-300'}>
          {step === 1 ? '1.' : '✓'} Practice
        </span>
        <span className="text-muted-foreground/40">›</span>
        <span className={step === 2 ? 'text-foreground' : 'text-muted-foreground/40'}>2. Your account</span>
      </div>

      {step === 1 && (
        <div className="space-y-3">
          <Field label="Practice name" required>
            <input
              type="text"
              autoFocus
              value={form.practice_name}
              onChange={(e) => update('practice_name', e.target.value)}
              placeholder="e.g. Pinecrest Endocrinology"
              className="field-input"
              required
            />
          </Field>
          <Field label="Practice phone (optional)">
            <input
              type="tel"
              value={form.practice_phone}
              onChange={(e) => update('practice_phone', e.target.value)}
              placeholder="(555) 123-4567"
              className="field-input"
            />
          </Field>
          <Field label="Time zone">
            <select
              value={form.practice_timezone}
              onChange={(e) => update('practice_timezone', e.target.value)}
              className="field-input"
            >
              <option value="America/New_York">Eastern (New York)</option>
              <option value="America/Chicago">Central (Chicago)</option>
              <option value="America/Denver">Mountain (Denver)</option>
              <option value="America/Phoenix">Arizona (no DST)</option>
              <option value="America/Los_Angeles">Pacific (Los Angeles)</option>
              <option value="America/Anchorage">Alaska</option>
              <option value="Pacific/Honolulu">Hawaii</option>
              <option value="America/Toronto">Toronto</option>
              <option value="America/Vancouver">Vancouver</option>
            </select>
          </Field>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3">
          <Field label="Your full name" required>
            <input
              type="text"
              autoFocus
              value={form.full_name}
              onChange={(e) => update('full_name', e.target.value)}
              placeholder="Dr. Jane Smith"
              className="field-input"
              required
              minLength={2}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Credentials">
              <input
                type="text"
                value={form.credentials}
                onChange={(e) => update('credentials', e.target.value)}
                placeholder="MD, DO, NP"
                className="field-input"
              />
            </Field>
            <Field label="NPI (optional)">
              <input
                type="text"
                value={form.npi}
                onChange={(e) => update('npi', e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="10 digits"
                className="field-input tabular-nums"
                inputMode="numeric"
              />
            </Field>
          </div>
          <Field label="Email" required>
            <input
              type="email"
              value={form.email}
              onChange={(e) => update('email', e.target.value)}
              placeholder="you@practice.com"
              className="field-input"
              required
              autoComplete="email"
            />
          </Field>
          <Field label="Password" required>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={(e) => update('password', e.target.value)}
                placeholder="At least 8 characters"
                className="field-input pr-10"
                required
                minLength={8}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </Field>
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm p-3 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 pt-2">
        {step === 2 && (
          <button
            type="button"
            onClick={() => setStep(1)}
            className="text-xs font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground"
          >
            ← Back
          </button>
        )}
        <button
          type="submit"
          disabled={submitting || (step === 1 && !step1Valid())}
          className="ml-auto inline-flex items-center gap-2 h-11 px-6 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-accent transition-colors disabled:opacity-50"
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : step === 1 ? (
            <>Continue <ArrowRight className="h-4 w-4" /></>
          ) : (
            'Create practice'
          )}
        </button>
      </div>

      <p className="text-[10px] text-muted-foreground text-center pt-2 leading-relaxed">
        By creating an account, you confirm you are a licensed healthcare provider and accept responsibility for clinical decisions. This is a beta product. HIPAA BAAs with subprocessors (Anthropic, OpenAI, Twilio, Dexcom) are required before processing real patient data.
      </p>

      <style jsx>{`
        :global(.field-input) {
          width: 100%;
          height: 40px;
          padding: 0 12px;
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
