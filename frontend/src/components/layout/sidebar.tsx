'use client';

import { History, ShieldCheck, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  match: (pathname: string) => boolean;
}

const NAV_ITEMS: NavItem[] = [
  {
    href: '/',
    label: 'Verify',
    icon: ShieldCheck,
    match: (p) => p === '/',
  },
  {
    href: '/runs',
    label: 'History',
    icon: History,
    match: (p) => p === '/runs' || p.startsWith('/runs/'),
  },
];

export const Sidebar = () => {
  const pathname = usePathname();
  return (
    <aside className="hidden md:flex md:w-60 lg:w-64 shrink-0 flex-col border-r bg-card/30">
      <div className="flex h-14 items-center gap-2 px-5 border-b">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Sparkles className="h-4 w-4" aria-hidden />
        </div>
        <span className="text-sm font-semibold tracking-tight">Errorfinder</span>
      </div>
      <nav className="flex-1 px-3 py-4">
        <ul className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const active = item.match(pathname);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors focus-ring',
                    active
                      ? 'bg-accent text-accent-foreground font-medium'
                      : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
                  )}
                  aria-current={active ? 'page' : undefined}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="border-t px-5 py-4">
        <p className="text-xs text-muted-foreground leading-relaxed">
          Verify AI responses claim-by-claim against authoritative sources.
        </p>
      </div>
    </aside>
  );
};
