import { ComingSoon } from '@/components/app/coming-soon';

export const metadata = { title: 'Schedule' };

export default function SchedulePage() {
  return (
    <ComingSoon title="Schedule" sprint="Sprint 6" description="Full calendar view, appointment booking, SMS reminders via Twilio, and patient confirmation flows." />
  );
}
