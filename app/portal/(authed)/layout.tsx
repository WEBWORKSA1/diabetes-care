import { redirect } from 'next/navigation';
import { getCurrentPortalSession } from '@/lib/portal/auth';
import { createServiceClient } from '@/lib/supabase/server';
import { PortalNav } from './portal-nav';
import { AlertTriangle } from 'lucide-react';

export const metadata = {
  title: 'Patient portal',
  robots: 'noindex,nofollow',
};

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await getCurrentPortalSession();
  if (!session) redirect('/portal/signin');

  const admin = createServiceClient();
  const [{ data: patient }, { data: org }] = await Promise.all([
    admin
      .from('patients')
      .select('id, first_name, last_name')
      .eq('id', session.patient_id)
      .single(),
    admin
      .from('organizations')
      .select('name, portal_emergency_text')
      .eq('id', session.organization_id)
      .single(),
  ]);

  if (!patient || !org) redirect('/portal/signin');

  return (
    <div className="min-h-screen bg-background">
      <PortalNav patientFirstName={patient.first_name} practiceName={org.name} />

      <div className="bg-red-50 dark:bg-red-950/40 border-b border-red-200 dark:border-red-900 px-4 py-2.5">
        <div className="max-w-3xl mx-auto flex items-start gap-2 text-xs text-red-900 dark:text-red-100">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>{org.portal_emergency_text}</span>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {children}
      </main>

      <footer className="max-w-3xl mx-auto px-4 py-12 text-center">
        <p className="text-xs text-muted-foreground">
          {org.name} · powered by diabetes.care
        </p>
      </footer>
    </div>
  );
}
