import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Globe } from 'lucide-react';
import { PortalSettingsForm } from './form';

export const metadata = { title: 'Portal settings' };

export default async function PortalSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('users')
    .select('role, organization_id, organizations(name, portal_enabled, portal_emergency_text)')
    .eq('id', user.id)
    .single();
  if (!profile) redirect('/login');

  return (
    <div className="max-w-2xl space-y-6">
      <Link href="/app" className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3 w-3" /> Dashboard
      </Link>
      <header className="space-y-2">
        <div className="inline-flex p-3 rounded-xl bg-primary/10 text-primary">
          <Globe className="h-5 w-5" />
        </div>
        <h1 className="font-display text-3xl tracking-tight">Patient portal</h1>
        <p className="text-sm text-muted-foreground">
          Magic-link based portal where patients can see results, fill out forms, and message the practice.
        </p>
      </header>
      <PortalSettingsForm initial={{ ...(profile.organizations as any), role: profile.role }} />
    </div>
  );
}
