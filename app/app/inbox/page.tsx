import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { InboxView } from '@/components/inbox/inbox-view';
import { Inbox } from 'lucide-react';

export const metadata = { title: 'Inbox' };

export default async function InboxPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('users')
    .select('role, inbox_filter_default, inbox_layout')
    .eq('id', user.id)
    .single();
  if (!profile) redirect('/login');

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-muted-foreground">
          <Inbox className="h-3 w-3" /> Clinical inbox
        </div>
        <h1 className="font-display text-3xl tracking-tight">Inbox</h1>
        <p className="text-sm text-muted-foreground">
          Everything pending: unsigned encounters, lab results, scribe drafts, CGM alerts, today&rsquo;s visits.
        </p>
      </header>

      <InboxView
        initialFilter={(profile.inbox_filter_default ?? 'mine') as any}
        initialLayout={(profile.inbox_layout ?? 'sections') as any}
        isOwner={profile.role === 'owner'}
      />
    </div>
  );
}
