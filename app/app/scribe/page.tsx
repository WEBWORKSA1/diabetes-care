import { ComingSoon } from '@/components/app/coming-soon';

export const metadata = { title: 'AI Scribe' };

export default function ScribePage() {
  return (
    <ComingSoon title="AI Scribe" sprint="Sprint 6" description="Record or upload visit audio. Whisper transcribes. Claude generates a diabetes-specific SOAP note in 60 seconds. Edit and sign." />
  );
}
