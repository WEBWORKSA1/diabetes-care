import { LoginForm } from './login-form';

export const metadata = { title: 'Sign in' };

export default function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string; error?: string };
}) {
  return (
    <main className="min-h-screen grid lg:grid-cols-2">
      <aside className="hidden lg:flex flex-col justify-between p-12 bg-primary text-primary-foreground">
        <div>
          <a href="/" className="font-display text-2xl tracking-tight">
            diabetes<span className="text-accent">.</span>care
          </a>
        </div>
        <div>
          <blockquote className="space-y-4">
            <p className="font-display text-2xl leading-tight italic text-primary-foreground/90">
              &ldquo;Every endocrinologist I&rsquo;ve spoken to is fighting their EHR. Not their patients, not their diagnoses &mdash; their software.&rdquo;
            </p>
            <footer className="font-mono text-xs uppercase tracking-wider text-primary-foreground/60">
              &mdash; Web, Founder
            </footer>
          </blockquote>
        </div>
        <div className="font-mono text-[10px] uppercase tracking-wider text-primary-foreground/50">
          HIPAA Compliant &middot; SOC 2 in progress
        </div>
      </aside>
      <section className="flex items-center justify-center p-8">
        <div className="w-full max-w-sm space-y-8">
          <header className="space-y-2 text-center">
            <h1 className="font-display text-3xl tracking-tight">Sign in</h1>
            <p className="text-sm text-muted-foreground">We&rsquo;ll send a sign-in link to your work email.</p>
          </header>
          <LoginForm next={searchParams.next} initialError={searchParams.error} />
          <p className="text-center text-xs text-muted-foreground">
            New to diabetes.care?{' '}
            <a href="/signup" className="text-foreground underline-offset-4 hover:underline">Create account</a>
          </p>
        </div>
      </section>
    </main>
  );
}
