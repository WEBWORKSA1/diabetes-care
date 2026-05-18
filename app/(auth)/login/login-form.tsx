'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export function LoginForm({ next, initialError }: { next?: string; initialError?: string }) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState<string | null>(initialError ?? null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('sending');
    setError(null);

    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/callback${next ? `?next=${encodeURIComponent(next)}` : ''}`;

    const { error: err } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo, shouldCreateUser: false },
    });

    if (err) {
      setError(err.message);
      setStatus('error');
      return;
    }
    setStatus('sent');
  }

  if (status === 'sent') {
    return (
      <div className="rounded-xl border border-border bg-card p-6 space-y-3 text-center">
        <div className="font-display text-xl">Check your inbox</div>
        <p className="text-sm text-muted-foreground">
          We sent a sign-in link to <strong className="text-foreground">{email}</strong>. It expires in 15 minutes.
        </p>
        <button
          onClick={() => setStatus('idle')}
          className="text-xs text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
        >
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="email" className="block text-sm font-medium">Email</label>
        <input
          id="email"
          type="email"
          required
          autoFocus
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="dr.smith@yourpractice.com"
          className="w-full h-11 px-4 rounded-full border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/30 text-destructive text-sm p-3">{error}</div>
      )}
      <button
        type="submit"
        disabled={status === 'sending' || !email}
        className="w-full h-11 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {status === 'sending' ? 'Sending…' : 'Send sign-in link'}
      </button>
    </form>
  );
}
