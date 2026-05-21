'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Pencil, FileText, Mic, FlaskConical, Send, Loader2, Copy, Check, X } from 'lucide-react';
import { LabEntryModal } from '@/components/labs/lab-entry-modal';

type IntakeForm = { id: string; name: string; kind: string };

export function PatientActionsBar({ patientId }: { patientId: string }) {
  const router = useRouter();
  const [showLab, setShowLab] = useState(false);
  const [showPortal, setShowPortal] = useState(false);

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        <Link
          href={`/app/patients/${patientId}/edit`}
          className="inline-flex items-center gap-2 h-10 px-4 rounded-full border border-input bg-card text-sm font-medium hover:bg-muted transition-colors"
        >
          <Pencil className="h-4 w-4" /> Edit
        </Link>
        <button
          onClick={() => setShowLab(true)}
          className="inline-flex items-center gap-2 h-10 px-4 rounded-full border border-input bg-card text-sm font-medium hover:bg-muted transition-colors"
        >
          <FlaskConical className="h-4 w-4" /> Add lab
        </button>
        <button
          onClick={() => setShowPortal(true)}
          className="inline-flex items-center gap-2 h-10 px-4 rounded-full border border-input bg-card text-sm font-medium hover:bg-muted transition-colors"
        >
          <Send className="h-4 w-4" /> Send portal link
        </button>
        <Link
          href={`/app/scribe/new?patient=${patientId}`}
          className="inline-flex items-center gap-2 h-10 px-4 rounded-full border border-accent/30 bg-accent/5 text-accent text-sm font-medium hover:bg-accent/10 transition-colors"
        >
          <Mic className="h-4 w-4" /> AI Scribe
        </Link>
        <Link
          href={`/app/encounters/new?patient=${patientId}`}
          className="inline-flex items-center gap-2 h-10 px-5 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-accent transition-colors"
        >
          <FileText className="h-4 w-4" /> New encounter
        </Link>
      </div>
      {showLab && <LabEntryModal patientId={patientId} onClose={() => setShowLab(false)} />}
      {showPortal && <SendPortalLinkModal patientId={patientId} onClose={() => setShowPortal(false)} />}
    </>
  );
}

function SendPortalLinkModal({ patientId, onClose }: { patientId: string; onClose: () => void }) {
  const [mode, setMode] = useState<'home' | 'intake'>('home');
  const [intakeForms, setIntakeForms] = useState<IntakeForm[]>([]);
  const [selectedFormId, setSelectedFormId] = useState<string>('');
  const [channel, setChannel] = useState<'sms' | 'email'>('sms');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ url?: string; delivered?: boolean; delivery_error?: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (mode === 'intake') {
      fetch('/api/intake-forms')
        .then((r) => r.json())
        .then((d) => {
          setIntakeForms(d.forms ?? []);
          if (d.forms?.length > 0) setSelectedFormId(d.forms[0].id);
        })
        .catch(() => {});
    }
  }, [mode]);

  async function send() {
    setSubmitting(true);
    setError(null);
    try {
      let res;
      if (mode === 'intake' && selectedFormId) {
        res = await fetch('/api/intake-forms/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ patient_id: patientId, intake_form_id: selectedFormId, send_via: channel }),
        });
      } else {
        res = await fetch('/api/portal/invite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ patient_id: patientId, destination: 'home', channel }),
        });
      }
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Send failed');
        return;
      }
      setResult(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function copyLink() {
    if (!result?.url) return;
    await navigator.clipboard.writeText(result.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl border border-border w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <header className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h2 className="font-display text-xl">Send portal link</h2>
          <button onClick={onClose} className="h-8 w-8 rounded-full hover:bg-muted flex items-center justify-center">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="px-6 py-5 space-y-4">
          {!result && (
            <>
              <div>
                <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">What to send</div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setMode('home')}
                    className={`p-3 rounded-lg border text-left text-sm ${mode === 'home' ? 'bg-primary/5 border-primary' : 'border-input hover:bg-muted'}`}
                  >
                    <div className="font-medium">Portal home</div>
                    <div className="text-xs text-muted-foreground">Generic sign-in link</div>
                  </button>
                  <button
                    onClick={() => setMode('intake')}
                    className={`p-3 rounded-lg border text-left text-sm ${mode === 'intake' ? 'bg-primary/5 border-primary' : 'border-input hover:bg-muted'}`}
                  >
                    <div className="font-medium">Intake form</div>
                    <div className="text-xs text-muted-foreground">Pre-visit questionnaire</div>
                  </button>
                </div>
              </div>

              {mode === 'intake' && (
                <label className="block space-y-1.5">
                  <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Form</div>
                  <select
                    value={selectedFormId}
                    onChange={(e) => setSelectedFormId(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm"
                  >
                    {intakeForms.length === 0 && <option>Loading…</option>}
                    {intakeForms.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </label>
              )}

              <label className="block space-y-1.5">
                <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Delivery</div>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setChannel('sms')} className={`h-10 rounded-lg border text-sm font-medium ${channel === 'sms' ? 'bg-primary/5 border-primary' : 'border-input hover:bg-muted'}`}>SMS</button>
                  <button onClick={() => setChannel('email')} className={`h-10 rounded-lg border text-sm font-medium ${channel === 'email' ? 'bg-primary/5 border-primary' : 'border-input hover:bg-muted'}`}>Email</button>
                </div>
                <p className="text-[10px] text-muted-foreground">SMS requires patient consent + mobile phone on file. Email delivery is not yet implemented — a link is created but you&rsquo;ll copy it manually.</p>
              </label>

              {error && <div className="rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm p-3">{error}</div>}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button onClick={onClose} className="h-10 px-4 rounded-full border border-input bg-card text-sm font-medium hover:bg-muted transition-colors">Cancel</button>
                <button
                  onClick={send}
                  disabled={submitting || (mode === 'intake' && !selectedFormId)}
                  className="inline-flex items-center gap-2 h-10 px-5 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-accent transition-colors disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Send link
                </button>
              </div>
            </>
          )}

          {result && (
            <div className="space-y-3">
              {result.delivered ? (
                <div className="rounded-lg bg-green-50 dark:bg-green-950 border border-green-300 dark:border-green-800 text-green-900 dark:text-green-100 text-sm p-3 flex items-center gap-2">
                  <Check className="h-4 w-4" /> Sent successfully
                </div>
              ) : (
                <div className="rounded-lg bg-amber-50 dark:bg-amber-950 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-100 text-sm p-3">
                  Link created but not delivered. {result.delivery_error}
                </div>
              )}
              <div className="space-y-1.5">
                <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Magic link (copy manually if needed)</div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-[10px] font-mono px-3 py-2 rounded-lg border border-input bg-muted truncate">{result.url}</code>
                  <button onClick={copyLink} className="shrink-0 h-9 w-9 rounded-full border border-input bg-card flex items-center justify-center hover:bg-muted transition-colors">
                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
              <button onClick={onClose} className="w-full h-10 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-accent transition-colors">Done</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
