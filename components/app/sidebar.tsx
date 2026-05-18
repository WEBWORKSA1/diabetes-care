'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, Calendar, FileText, Activity, Settings, Mic, FlaskConical } from 'lucide-react';
import { cn } from '@/lib/utils';

const nav = [
  { label: 'Today', href: '/app', icon: LayoutDashboard, exact: true },
  { label: 'Patients', href: '/app/patients', icon: Users },
  { label: 'Schedule', href: '/app/schedule', icon: Calendar },
  { label: 'Encounters', href: '/app/encounters', icon: FileText },
  { label: 'Labs', href: '/app/labs', icon: FlaskConical },
  { label: 'CGM', href: '/app/cgm', icon: Activity, badge: 'New' },
  { label: 'AI Scribe', href: '/app/scribe', icon: Mic },
];

export function Sidebar({ profile }: { profile: any }) {
  const pathname = usePathname();
  const org = profile.organizations;

  return (
    <aside className="hidden lg:flex w-64 flex-col bg-card border-r border-border">
      <div className="px-6 py-5 border-b border-border">
        <Link href="/app" className="font-display text-xl tracking-tight">
          diabetes<span className="text-accent">.</span>care
        </Link>
        <div className="text-xs text-muted-foreground truncate mt-1">{org?.name}</div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {nav.map((item) => {
          const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                isActive ? 'bg-primary text-primary-foreground' : 'text-foreground/70 hover:bg-muted hover:text-foreground'
              )}
            >
              <span className="flex items-center gap-3">
                <item.icon className="h-4 w-4" />
                {item.label}
              </span>
              {item.badge && (
                <span className={cn(
                  'text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded',
                  isActive ? 'bg-primary-foreground/20' : 'bg-accent/10 text-accent'
                )}>
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-3 border-t border-border space-y-0.5">
        <Link
          href="/app/settings"
          className={cn(
            'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
            pathname.startsWith('/app/settings') ? 'bg-primary text-primary-foreground' : 'text-foreground/70 hover:bg-muted hover:text-foreground'
          )}
        >
          <Settings className="h-4 w-4" />
          Settings
        </Link>
      </div>

      {org?.plan === 'trial' && org?.trial_ends_at && (
        <div className="m-3 p-3 rounded-lg bg-accent/10 border border-accent/30 text-xs">
          <div className="font-mono uppercase tracking-wider text-accent text-[10px] mb-1">Trial</div>
          <div className="text-foreground">
            {Math.max(0, Math.ceil((new Date(org.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))} days remaining
          </div>
        </div>
      )}
    </aside>
  );
}
