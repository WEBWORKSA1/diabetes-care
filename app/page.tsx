import Link from 'next/link';
import { ArrowRight, Mic, Activity, Calendar, FileSignature, Brain } from 'lucide-react';

export const metadata = {
  title: 'diabetes.care — Endocrinology EHR for diabetes practices',
  description: 'Charting, CGM analytics, AI scribe, scheduling. Purpose-built for endocrinologists.',
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="px-6 py-5 flex items-center justify-between max-w-6xl mx-auto">
        <Link href="/" className="font-display text-xl tracking-tight">
          diabetes<span className="text-accent">.</span>care
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/login" className="text-sm font-medium hover:text-accent transition-colors">
            Sign in
          </Link>
          <Link
            href="/signup"
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-accent transition-colors"
          >
            Start trial
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="px-6 py-16 sm:py-24 max-w-4xl mx-auto text-center space-y-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 text-accent text-xs font-mono uppercase tracking-wider">
          <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
          Built for endocrinologists
        </div>
        <h1 className="font-display text-5xl sm:text-6xl tracking-tight leading-[1.05]">
          The EHR built for diabetes practices.
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          Diabetes-specific charting templates. Dexcom CGM data in the patient chart. AI scribe that handles the SOAP note. Spend less time on the keyboard, more on the patient.
        </p>
        <div className="flex items-center justify-center gap-3 pt-4 flex-wrap">
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 h-12 px-7 rounded-full bg-primary text-primary-foreground font-medium hover:bg-accent transition-colors"
          >
            Start your 30-day trial <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 h-12 px-7 rounded-full border border-input bg-card font-medium hover:bg-muted transition-colors"
          >
            Sign in
          </Link>
        </div>
        <p className="text-xs text-muted-foreground">No credit card. Cancel anytime.</p>
      </section>

      {/* Feature grid */}
      <section className="px-6 py-16 max-w-6xl mx-auto">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <Feature
            icon={FileSignature}
            title="Diabetes-native charting"
            description="SOAP templates pre-loaded for T2DM follow-up, T1DM, GLP-1 initiation, CGM review. Insulin titration calculator built in."
          />
          <Feature
            icon={Activity}
            title="Dexcom CGM in the chart"
            description="AGP report, time in range, pattern detection (nocturnal hypo, dawn phenomenon, postprandial spikes). Hourly auto-sync."
          />
          <Feature
            icon={Mic}
            title="AI scribe with source linking"
            description="Record the visit, get a SOAP draft in 60 seconds. Every line links to the audio segment that supports it. Claude or GPT-4o."
          />
          <Feature
            icon={Calendar}
            title="Scheduling + SMS reminders"
            description="Weekly availability windows, slot booking, automated 24h and 2h SMS reminders. Patients can cancel via link."
          />
          <Feature
            icon={Brain}
            title="Built by a single team"
            description="No certified consultants. No 6-month implementation. Sign up, add patients, start charting today."
          />
          <Feature
            icon={ArrowRight}
            title="Pilot pricing"
            description="Solo $399/mo. Group rates available. AI scribe add-on $99/mo. Patient engagement add-on $149/mo."
          />
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-20 max-w-3xl mx-auto text-center space-y-6">
        <h2 className="font-display text-3xl sm:text-4xl tracking-tight">
          Ready to stop documenting and start practicing?
        </h2>
        <Link
          href="/signup"
          className="inline-flex items-center gap-2 h-12 px-7 rounded-full bg-primary text-primary-foreground font-medium hover:bg-accent transition-colors"
        >
          Start your trial <ArrowRight className="h-4 w-4" />
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-8">
        <div className="max-w-6xl mx-auto flex items-center justify-between text-xs text-muted-foreground flex-wrap gap-3">
          <div>© {new Date().getFullYear()} diabetes.care</div>
          <div className="flex items-center gap-4">
            <Link href="/signup" className="hover:text-foreground transition-colors">Sign up</Link>
            <Link href="/login" className="hover:text-foreground transition-colors">Sign in</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Feature({ icon: Icon, title, description }: { icon: any; title: string; description: string }) {
  return (
    <div className="bg-card rounded-2xl border border-border p-6 space-y-3 hover:border-foreground/30 transition-colors">
      <div className="p-2 rounded-lg bg-accent/10 text-accent w-fit">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="font-display text-lg">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
}
