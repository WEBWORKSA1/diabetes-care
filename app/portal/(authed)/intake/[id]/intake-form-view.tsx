'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

type IntakeField = {
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
};

export function IntakeFormView({ response }: { response: any }) {
  const router = useRouter();
  const form = response.intake_forms;
  const fields: IntakeField[] = form.fields ?? [];
  const alreadySubmitted = response.status === 'submitted' || response.status === 'reviewed';

  const [values, setValues] = useState<Record<string, any>>(response.responses ?? {});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(alreadySubmitted);

  function update(fieldId: string, value: any) {
    setValues((v) => ({ ...v, [fieldId]: value }));
  }

  function validate(): string | null {
    for (const f of fields) {
      if (f.required) {
        const v = values[f.id];
        if (v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)) {
          return `"${f.label}" is required.`;
        }
      }
    }
    return null;
  }

  async function submit() {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/portal/intake/${response.id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responses: values }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Could not submit form');
        return;
      }
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="py-12 space-y-4 text-center">
        <div className="inline-flex p-4 rounded-full bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <h1 className="font-display text-2xl">Thanks for filling this out</h1>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Your provider will review your answers before your visit. If anything urgent comes up, please call the practice directly.
        </p>
        <button
          onClick={() => router.push('/portal')}
          className="inline-flex items-center gap-2 h-10 px-5 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-accent transition-colors"
        >
          Back to portal
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); submit(); }}
      className="space-y-6"
    >
      <header className="space-y-1">
        <h1 className="font-display text-2xl sm:text-3xl tracking-tight">{form.name}</h1>
        {form.description && <p className="text-sm text-muted-foreground">{form.description}</p>}
      </header>

      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm p-3 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="space-y-5">
        {fields.map((field, idx) => (
          <FieldRenderer
            key={field.id}
            field={field}
            value={values[field.id]}
            onChange={(v) => update(field.id, v)}
            number={idx + 1}
          />
        ))}
      </div>

      <div className="sticky bottom-0 -mx-4 px-4 py-3 bg-background/95 backdrop-blur border-t border-border flex items-center justify-end gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center gap-2 h-11 px-6 rounded-full bg-primary text-primary-foreground font-medium hover:bg-accent transition-colors disabled:opacity-50"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Submit
        </button>
      </div>
    </form>
  );
}

function FieldRenderer({ field, value, onChange, number }: { field: IntakeField; value: any; onChange: (v: any) => void; number: number }) {
  return (
    <section className="space-y-2">
      <label className="block font-medium">
        <span className="text-muted-foreground mr-2 tabular-nums">{number}.</span>
        {field.label}
        {field.required && <span className="text-destructive ml-1">*</span>}
      </label>
      {field.help_text && <p className="text-xs text-muted-foreground">{field.help_text}</p>}

      {field.type === 'text' && (
        <input
          type="text"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className="w-full h-11 px-3 rounded-lg border border-input bg-background text-base"
        />
      )}

      {field.type === 'textarea' && (
        <textarea
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          rows={4}
          className="w-full px-3 py-2 rounded-lg border border-input bg-background text-base resize-y"
        />
      )}

      {field.type === 'number' && (
        <input
          type="number"
          inputMode="decimal"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
          placeholder={field.placeholder}
          className="w-full h-11 px-3 rounded-lg border border-input bg-background text-base tabular-nums"
        />
      )}

      {field.type === 'date' && (
        <input
          type="date"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          className="w-full h-11 px-3 rounded-lg border border-input bg-background text-base tabular-nums"
        />
      )}

      {field.type === 'select' && (
        <select
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          className="w-full h-11 px-3 rounded-lg border border-input bg-background text-base"
        >
          <option value="">Select…</option>
          {(field.options ?? []).map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      )}

      {field.type === 'radio' && (
        <div className="space-y-2">
          {(field.options ?? []).map((opt) => (
            <label key={opt} className="flex items-center gap-3 p-3 rounded-lg border border-input cursor-pointer hover:bg-muted/30 transition-colors">
              <input
                type="radio"
                name={field.id}
                value={opt}
                checked={value === opt}
                onChange={() => onChange(opt)}
              />
              <span className="text-sm">{opt}</span>
            </label>
          ))}
        </div>
      )}

      {field.type === 'checkbox' && (
        <div className="space-y-2">
          {(field.options ?? []).map((opt) => {
            const checked = Array.isArray(value) && value.includes(opt);
            return (
              <label key={opt} className="flex items-center gap-3 p-3 rounded-lg border border-input cursor-pointer hover:bg-muted/30 transition-colors">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => {
                    const current = Array.isArray(value) ? value : [];
                    onChange(e.target.checked ? [...current, opt] : current.filter((v: string) => v !== opt));
                  }}
                />
                <span className="text-sm">{opt}</span>
              </label>
            );
          })}
        </div>
      )}

      {field.type === 'scale' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{field.scale_min_label ?? field.scale_min ?? 0}</span>
            <span>{field.scale_max_label ?? field.scale_max ?? 10}</span>
          </div>
          <div className="flex items-center gap-2">
            {Array.from({ length: (field.scale_max ?? 10) - (field.scale_min ?? 0) + 1 }, (_, i) => {
              const v = (field.scale_min ?? 0) + i;
              const active = value === v;
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => onChange(v)}
                  className={`flex-1 h-11 rounded-lg border text-sm font-mono tabular-nums transition-colors ${
                    active ? 'bg-primary text-primary-foreground border-primary' : 'border-input hover:bg-muted'
                  }`}
                >
                  {v}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
