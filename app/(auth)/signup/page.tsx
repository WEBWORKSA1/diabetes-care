import { SignupForm } from './signup-form';

export const metadata = { title: 'Create account' };

export default function SignupPage() {
  return (
    <main className="min-h-screen grid lg:grid-cols-2">
      <aside className="hidden lg:flex flex-col justify-between p-12 bg-primary text-primary-foreground">
        <div>
          <a href="/" className="font-display text-2xl tracking-tight">
            diabetes<span className="text-accent">.</span>care
          </a>
        </div>
        <div className="space-y-6">
          <h2 className="font-display text-3xl leading-tight italic">Join the private beta.</h2>
          <ul className="space-y-3 text-sm text-primary-foreground/80">
            <li>· 60 days free</li>
            <li>· Lock-in launch pricing</li>
            <li>· Direct line to the founder</li>
            <li>· Weekly feedback calls</li>
          </ul>
        </div>
        <div className="font-mono text-[10px] uppercase tracking-wider text-primary-foreground/50">
          HIPAA Compliant &middot; SOC 2 in progress
        </div>
      </aside>
      <section className="flex items-center justify-center p-8">
        <div className="w-full max-w-sm space-y-8">
          <header className="space-y-2 text-center">
            <h1 className="font-display text-3xl tracking-tight">Create your practice</h1>
            <p className="text-sm text-muted-foreground">Start your 60-day pilot. No credit card.</p>
          </header>
          <SignupForm />
          <p className="text-center text-xs text-muted-foreground">
            Already have an account?{' '}
            <a href="/login" className="text-foreground underline-offset-4 hover:underline">Sign in</a>
          </p>
        </div>
      </section>
    </main>
  );
}
