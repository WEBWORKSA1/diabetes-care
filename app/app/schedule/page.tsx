import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { ScheduleView } from './schedule-view';

export const metadata = { title: 'Schedule' };

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: { date?: string; provider?: string };
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('users')
    .select('id, full_name, organization_id, role')
    .eq('id', user.id)
    .single();
  if (!profile) redirect('/login');

  // Load providers in this org
  const { data: providers } = await supabase
    .from('users')
    .select('id, full_name, credentials, role')
    .eq('organization_id', profile.organization_id)
    .eq('is_active', true)
    .in('role', ['owner', 'provider'])
    .order('full_name');

  const selectedProviderId = searchParams.provider ?? user.id;

  return (
    <ScheduleView
      currentUser={profile as any}
      providers={(providers ?? []) as any}
      initialProviderId={selectedProviderId}
      initialDate={searchParams.date}
    />
  );
}
