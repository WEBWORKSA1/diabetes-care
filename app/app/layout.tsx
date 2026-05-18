import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Sidebar } from '@/components/app/sidebar';
import { TopBar } from '@/components/app/top-bar';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('users')
    .select('id, full_name, email, role, organization_id, organizations(name, slug, plan, trial_ends_at)')
    .eq('id', user.id)
    .single();

  if (!profile) {
    redirect('/login?error=no_profile');
  }

  return (
    <div className="min-h-screen bg-muted/30 flex">
      <Sidebar profile={profile} />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar profile={profile} />
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-6 lg:px-10 py-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
