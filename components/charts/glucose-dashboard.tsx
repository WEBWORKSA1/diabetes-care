import { Activity } from 'lucide-react';
import Link from 'next/link';

/**
 * Glucose dashboard skeleton — placeholder for Sprint 5 (Dexcom CGM integration).
 * Renders TIR/avg/CV stat tiles with empty state ready to receive real data.
 */
export function GlucoseDashboard({
  patientId,
  hasCgm = false,
}: {
  patientId: string;
  hasCgm?: boolean;
}) {
  if (!hasCgm) {
    return (
      <section className="bg-card rounded-2xl border border-border">
        <header className="px-6 py-5 border-b border-border flex items-center justify-between">
          <h2 className="font-display text-xl flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" /> Continuous Glucose Monitor
          </h2>
          <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-muted text-muted-foreground">Sprint 5</span>
        </header>
        <div className="px-6 py-12 text-center">
          <Activity className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="font-display text-lg">No CGM connected</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
            Connect this patient&rsquo;s Dexcom G6/G7 to see time-in-range, glucose variability, and AGP reports inline with their chart.
          </p>
          <Link
            href={`/app/cgm?patient=${patientId}`}
            className="inline-block mt-4 text-xs font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground"
          >
            Available in Sprint 5 →
          </Link>
        </div>
      </section>
    );
  }

  // Live CGM dashboard renders here in Sprint 5 with TIR bar, avg glucose, CV, AGP
  return null;
}
