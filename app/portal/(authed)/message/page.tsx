import { getCurrentPortalSession } from '@/lib/portal/auth';
import { redirect } from 'next/navigation';
import { MessageForm } from './message-form';
import { AlertTriangle } from 'lucide-react';

export const metadata = { title: 'Send a message' };

export default async function PortalMessagePage() {
  const session = await getCurrentPortalSession();
  if (!session) redirect('/portal/signin');

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl sm:text-3xl tracking-tight">Send a message</h1>
        <p className="text-sm text-muted-foreground mt-1">For non-urgent questions. Your practice will respond within 1–2 business days.</p>
      </header>

      <section className="bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800 rounded-2xl p-4 flex items-start gap-3">
        <AlertTriangle className="h-4 w-4 text-red-700 dark:text-red-300 shrink-0 mt-0.5" />
        <div className="text-sm text-red-900 dark:text-red-100">
          <strong>Not for emergencies.</strong> If you are having a medical emergency, dangerously low or high blood sugar, chest pain, severe shortness of breath, or thoughts of self-harm, call 911 or go to your nearest emergency room.
        </div>
      </section>

      <MessageForm />
    </div>
  );
}
