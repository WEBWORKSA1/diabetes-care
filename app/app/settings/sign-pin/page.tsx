import { SignPinForm } from './form';
import Link from 'next/link';
import { ArrowLeft, Lock } from 'lucide-react';

export const metadata = { title: 'Sign PIN' };

export default function SignPinSettingsPage() {
  return (
    <div className="max-w-md space-y-8">
      <Link href="/app/settings" className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3 w-3" /> Settings
      </Link>
      <header className="space-y-2">
        <div className="inline-flex p-3 rounded-xl bg-accent/10 text-accent">
          <Lock className="h-5 w-5" />
        </div>
        <h1 className="font-display text-3xl tracking-tight">Sign PIN</h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Set a 4-6 digit PIN that you&rsquo;ll enter to sign and lock encounters. This is a deliberate signature step — a separate barrier from logging in — to ensure intentional finalization of clinical notes.
        </p>
      </header>
      <SignPinForm />
    </div>
  );
}
