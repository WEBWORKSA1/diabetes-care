import { ComingSoon } from '@/components/app/coming-soon';

export const metadata = { title: 'CGM' };

export default function CGMPage() {
  return (
    <ComingSoon title="CGM" sprint="Sprint 5" description="Dexcom G6/G7 integration via OAuth. Time-in-range, glucose variability, AGP reports, nocturnal hypo alerts." />
  );
}
