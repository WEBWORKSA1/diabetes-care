import { ComingSoon } from '@/components/app/coming-soon';

export const metadata = { title: 'Settings' };

export default function SettingsPage() {
  return (
    <ComingSoon title="Settings" sprint="Sprint 7" description="Practice info, team management, billing (Stripe), HIPAA compliance documents, BAA management, audit log viewer." />
  );
}
