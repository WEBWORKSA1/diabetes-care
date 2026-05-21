'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Send, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

export function MessageForm() {
  const router = useRouter();
  const [subject, setSubject] = useState('');
  const [bodyText, setBodyText] = useState('');
  const [priority, setPriority] = useState<'routine' | 'urgent'>('routine');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!subject.trim() || !bodyText.trim()) {
      setError('Please add a subject and message.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/portal/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, body: bodyText, priority }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Could not send message');
        return;
      }
      setSent(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div className="py-12 space-y-4 text-center">
        <div className="inline-flex p-4 rounded-full bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <h2 className="font-display text-2xl">Message sent</h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Your practice will respond within 1–2 business days. If your issue becomes urgent, please call them directly.
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
      className="space-y-4"
    >
      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm p-3 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" /> {error}
        </div>
      )}

      <label className="block space-y-1.5">
        <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Subject</div>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          maxLength={150}
          placeholder="What is this about?"
          className="w-full h-11 px-3 rounded-lg border border-input bg-background text-base"
          required
        />
      </label>

      <label className="block space-y-1.5">
        <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Your message</div>
        <textarea
          value={bodyText}
          onChange={(e) => setBodyText(e.target.value)}
          maxLength={2000}
          rows={8}
          placeholder="Tell us what's going on. The more detail you can share, the better we can help."
          className="w-full px-3 py-2 rounded-lg border border-input bg-background text-base resize-y"
          required
        />
        <div className="text-[10px] font-mono text-muted-foreground text-right">{bodyText.length} / 2000</div>
      </label>

      <fieldset className="space-y-2">
        <legend className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Priority</legend>
        <label className="flex items-start gap-3 p-3 rounded-lg border border-input cursor-pointer hover:bg-muted/30 transition-colors">
          <input type="radio" name="priority" checked={priority === 'routine'} onChange={() => setPriority('routine')} className="mt-1" />
          <div>
            <div className="font-medium text-sm">Routine</div>
            <div className="text-xs text-muted-foreground">Response within 1–2 business days.</div>
          </div>
        </label>
        <label className="flex items-start gap-3 p-3 rounded-lg border border-input cursor-pointer hover:bg-muted/30 transition-colors">
          <input type="radio" name="priority" checked={priority === 'urgent'} onChange={() => setPriority('urgent')} className="mt-1" />
          <div>
            <div className="font-medium text-sm">Urgent (not an emergency)</div>
            <div className="text-xs text-muted-foreground">Same business day. <strong>If this is an emergency, call 911.</strong></div>
          </div>
        </label>
      </fieldset>

      <button
        type="submit"
        disabled={submitting}
        className="inline-flex items-center gap-2 h-11 px-6 rounded-full bg-primary text-primary-foreground font-medium hover:bg-accent transition-colors disabled:opacity-50"
      >
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        Send message
      </button>
    </form>
  );
}
