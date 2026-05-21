'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Home, FileText, Calendar, FlaskConical, MessageSquare, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';

const nav = [
  { href: '/portal', label: 'Home', icon: Home, exact: true },
  { href: '/portal/appointments', label: 'Visits', icon: Calendar },
  { href: '/portal/results', label: 'Results', icon: FlaskConical },
  { href: '/portal/forms', label: 'Forms', icon: FileText },
  { href: '/portal/message', label: 'Message us', icon: MessageSquare },
];

export function PortalNav({ patientFirstName, practiceName }: { patientFirstName: string; practiceName: string }) {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    await fetch('/api/portal/signout', { method: 'POST' });
    router.push('/portal/signin');
  }

  return (
    <header className="bg-card border-b border-border sticky top-0 z-10">
      <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/portal" className="font-display text-lg tracking-tight truncate max-w-[60%]">
          {practiceName}
        </Link>
        <button
          onClick={signOut}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-mono uppercase tracking-wider text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <LogOut className="h-3 w-3" /> Sign out
        </button>
      </div>
      <nav className="max-w-3xl mx-auto px-2 flex items-center gap-1 overflow-x-auto">
        {nav.map((item) => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors shrink-0',
                active
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              <item.icon className="h-3.5 w-3.5" /> {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
