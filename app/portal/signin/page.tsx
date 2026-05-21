export const metadata = { title: 'Sign in', robots: 'noindex,nofollow' };

export default function PortalSignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md text-center space-y-5">
        <h1 className="font-display text-3xl tracking-tight">Patient portal</h1>
        <p className="text-sm text-muted-foreground">
          We don&rsquo;t use passwords here. To sign in, click the link your practice sent you in a text message or email.
        </p>
        <div className="bg-card border border-border rounded-2xl p-6 text-left space-y-3">
          <h2 className="font-medium">Didn&rsquo;t get a link?</h2>
          <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside">
            <li>Check your text messages for a recent link from your practice.</li>
            <li>Links expire after 7 days. If yours is older, ask the practice to send a new one.</li>
            <li>Call your practice directly — they can send you a new link.</li>
          </ul>
        </div>
        <p className="text-xs text-muted-foreground pt-4">
          If this is a medical emergency, call 911. Do not use this portal for urgent issues.
        </p>
      </div>
    </div>
  );
}
