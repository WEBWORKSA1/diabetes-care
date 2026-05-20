import Link from 'next/link';
import { SignupForm } from './signup-form';

export const metadata = { title: 'Start your trial — diabetes.care' };

export default function SignupPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <Link href="/" className="font-display text-2xl tracking-tight">
            diabetes<span className="text-accent">.</span>care
          </Link>
          <h1 className="font-display text-3xl tracking-tight">Start your 30-day trial</h1>
          <p className="text-sm text-muted-foreground">
            No credit card. Cancel anytime.
          </p>
        </div>

        <SignupForm />

        <p className="text-center text-xs text-muted-foreground">
          Already have an account?{' '}
          <Link href="/login" className="underline hover:text-foreground">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
