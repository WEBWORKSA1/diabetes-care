import { getCurrentPortalSession } from '@/lib/portal/auth';
import { createServiceClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import { IntakeFormView } from './intake-form-view';

export const metadata = { title: 'Pre-visit form' };

export default async function PortalIntakePage({ params }: { params: { id: string } }) {
  const session = await getCurrentPortalSession();
  if (!session) redirect('/portal/signin');

  const admin = createServiceClient();
  const { data: response } = await admin
    .from('intake_form_responses')
    .select(`
      id, status, responses, started_at, submitted_at, expires_at,
      intake_forms(name, description, fields)
    `)
    .eq('id', params.id)
    .eq('patient_id', session.patient_id)
    .single();

  if (!response) return notFound();
  if (new Date(response.expires_at) < new Date()) {
    return (
      <div className="py-12 text-center space-y-3">
        <h1 className="font-display text-2xl">This form has expired</h1>
        <p className="text-sm text-muted-foreground">Please contact your practice for a new link.</p>
      </div>
    );
  }

  return <IntakeFormView response={response as any} />;
}
