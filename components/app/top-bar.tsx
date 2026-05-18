'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, LogOut, User } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export function TopBar({ profile }: { profile: any }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  const initials = profile.full_name.split(' ').map((s: string) => s[0]).join('').toUpperCase().slice(0, 2);

  return (
    <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="px-6 lg:px-10 py-3 flex items-center justify-between gap-6">
        <div className="flex-1 max-w-md">
          <button className="w-full inline-flex items-center gap-3 h-9 px-4 rounded-full border border-input bg-card text-sm text-muted-foreground hover:bg-muted transition-colors">
            <Search className="h-4 w-4" />
            <span>Search patients…</span>
            <kbd className="ml-auto font-mono text-[10px] tracking-wider bg-muted px-1.5 py-0.5 rounded">⌘K</kbd>
          </button>
        </div>

        <div className="relative" ref={menuRef}>
          <button onClick={() => setMenuOpen((v) => !v)} className="flex items-center gap-3 group">
            <div className="text-right hidden sm:block">
              <div className="text-sm font-medium">{profile.full_name}</div>
              <div className="text-xs text-muted-foreground capitalize">{profile.role}</div>
            </div>
            <div className="h-9 w-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-medium ring-2 ring-transparent group-hover:ring-accent/30 transition">
              {initials}
            </div>
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-card rounded-xl border border-border shadow-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <div className="text-sm font-medium truncate">{profile.full_name}</div>
                <div className="text-xs text-muted-foreground truncate">{profile.email}</div>
              </div>
              <Link href="/app/settings/profile" className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-muted transition-colors">
                <User className="h-4 w-4" />
                Profile
              </Link>
              <button onClick={handleSignOut} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-muted transition-colors text-left">
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
