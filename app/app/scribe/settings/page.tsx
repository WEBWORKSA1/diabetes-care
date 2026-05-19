import { ScribeSettingsForm } from './form';
import Link from 'next/link';
import { ArrowLeft, Mic } from 'lucide-react';

export const metadata = { title: 'AI Scribe settings' };

export default function ScribeSettingsPage() {
  return (
    <div className="max-w-2xl space-y-8">
      <Link
        href="/app/scribe"
        className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" /> AI Scribe
      </Link>
      <header className="space-y-2">
        <div className="inline-flex p-3 rounded-xl bg-accent/10 text-accent">
          <Mic className="h-5 w-5" />
        </div>
        <h1 className="font-display text-3xl tracking-tight">AI Scribe settings</h1>
        <p className="text-sm text-muted-foreground">
          Practice-wide configuration. Owners only.
        </p>
      </header>
      <ScribeSettingsForm />
    </div>
  );
}
