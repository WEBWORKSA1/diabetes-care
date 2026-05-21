'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, ChevronRight, X, Sparkles } from 'lucide-react';

type OnboardingState = {
  practice_profile_complete: boolean;
  availability_set: boolean;
  first_patient_added: boolean;
  sms_configured: boolean;
  scribe_tested: boolean;
  dismissed_at: string | null;
};

export function OnboardingChecklist() {
  const [state, setState] = useState<OnboardingState | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/onboarding')
      .then((r) => r.json())
      .then((d) => {
        setState(d.state ?? null);
        setIsOwner(!!d.is_owner);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function dismiss() {
    await fetch('/api/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dismissed: true }),
    });
    setState((s) => s ? { ...s, dismissed_at: new Date().toISOString() } : s);
  }

  if (loading || !state || !isOwner || state.dismissed_at) return null;

  const steps = [
    {
      key: 'availability_set',
      done: state.availability_set,
      label: 'Set your availability',
      desc: 'Tell the system when you see patients so slots can be generated.',
      href: '/app/schedule/availability',
    },
    {
      key: 'first_patient_added',
      done: state.first_patient_added,
      label: 'Add your first patient',
      desc: 'Create a patient record to start charting.',
      href: '/app/patients/new',
    },
    {
      key: 'sms_configured',
      done: state.sms_configured,
      label: 'Configure SMS reminders',
      desc: 'Set up Twilio credentials in your env, then enable in settings.',
      href: '/app/schedule/sms-settings',
    },
    {
      key: 'scribe_tested',
      done: state.scribe_tested,
      label: 'Try the AI Scribe',
      desc: 'Record a 1-minute test note to see the SOAP draft pipeline.',
      href: '/app/scribe',
    },
  ];

  const completed = steps.filter((s) => s.done).length;
  if (completed === steps.length) {
    return null;
  }

  return (
    <section className="bg-card rounded-2xl border border-accent/30 overflow-hidden">
      <header className="px-6 py-5 border-b border-accent/20 bg-accent/5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-accent/10 text-accent">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h2 className="font-display text-lg">Get your practice set up</h2>
            <p className="text-xs text-muted-foreground">{completed} of {steps.length} done</p>
          </div>
        </div>
        <button onClick={dismiss} className="h-8 w-8 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors" title="Dismiss">
          <X className="h-4 w-4" />
        </button>
      </header>
      <ul className="divide-y divide-border">
        {steps.map((step) => (
          <li key={step.key}>
            <Link
              href={step.href}
              className={`flex items-center gap-4 px-6 py-4 transition-colors ${step.done ? 'opacity-60' : 'hover:bg-muted/30'}`}
            >
              <div className={`shrink-0 h-7 w-7 rounded-full flex items-center justify-center ${step.done ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300' : 'bg-muted text-muted-foreground'}`}>
                {step.done ? <Check className="h-4 w-4" /> : <div className="h-2 w-2 rounded-full bg-current" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className={`font-medium ${step.done ? 'line-through' : ''}`}>{step.label}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{step.desc}</div>
              </div>
              {!step.done && <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
