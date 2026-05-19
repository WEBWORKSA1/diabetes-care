import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Clock } from 'lucide-react';
import { AvailabilityForm } from './form';

export const metadata = { title: 'Availability' };

export default async function AvailabilityPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('users')
    .select('id, full_name, organization_id, role')
    .eq('id', user.id)
    .single();
  if (!profile) redirect('/login');

  const { data: windows } = await supabase
    .from('provider_availability')
    .select('*')
    .eq('provider_id', user.id)
    .eq('is_active', true)
    .order('day_of_week')
    .order('start_time');

  return (
    <div className="max-w-3xl space-y-6">
      <Link href="/app/schedule" className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3 w-3" /> Schedule
      </Link>
      <header className="space-y-2">
        <div className="inline-flex p-3 rounded-xl bg-primary/10 text-primary">
          <Clock className="h-5 w-5" />
        </div>
        <h1 className="font-display text-3xl tracking-tight">Your availability</h1>
        <p className="text-sm text-muted-foreground">
          Set the days and hours you see patients. Slots are generated in your specified duration.
        </p>
      </header>
      <AvailabilityForm providerId={user.id} initial={(windows ?? []) as any} />
    </div>
  );
}
