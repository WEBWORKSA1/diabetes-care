import Link from 'next/link';
import { Sparkles } from 'lucide-react';

export function ComingSoon({ title, sprint, description }: { title: string; sprint: string; description: string }) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="max-w-md text-center space-y-4">
        <div className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider px-3 py-1.5 rounded-full bg-accent/10 text-accent">
          <Sparkles className="h-3 w-3" />
          {sprint}
        </div>
        <h1 className="font-display text-4xl tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
        <Link href="/app" className="inline-block mt-4 text-xs font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground">
          ← Back to dashboard
        </Link>
      </div>
    </div>
  );
}
