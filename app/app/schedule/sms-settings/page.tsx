import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, MessageSquare } from 'lucide-react';
import { SmsSettingsForm } from './form';

export const metadata = { title: 'SMS settings' };

export default async function SmsSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('users')
    .select('organization_id, role, organizations(name, sms_enabled, sms_24h_reminder_enabled, sms_2h_reminder_enabled, sms_from_name)')
    .eq('id', user.id)
    .single();
  if (!profile) redirect('/login');

  const org = (profile.organizations as any);

  return (
    <div className="max-w-2xl space-y-6">
      <Link href="/app/schedule" className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3 w-3" /> Schedule
      </Link>
      <header className="space-y-2">
        <div className="inline-flex p-3 rounded-xl bg-primary/10 text-primary">
          <MessageSquare className="h-5 w-5" />
        </div>
        <h1 className="font-display text-3xl tracking-tight">SMS reminders</h1>
        <p className="text-sm text-muted-foreground">
          Practice-wide SMS settings. Patients must have SMS consent on their record for reminders to send.
        </p>
      </header>
      <SmsSettingsForm initial={{ ...org, role: profile.role }} />
    </div>
  );
}
