'use client';

import { Sparkles, History, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { cn } from '@/lib/utils';

const MOBILE_NAV = [
  { href: '/', label: 'Verify', icon: ShieldCheck, match: (p: string) => p === '/' },
  {
    href: '/runs',
    label: 'History',
    icon: History,
    match: (p: string) => p === '/runs' || p.startsWith('/runs/'),
  },
];

export const AppHeader = () => {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/80 backdrop-blur px-4 md:px-6">
      <div className="flex items-center gap-2 md:hidden">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Sparkles className="h-4 w-4" aria-hidden />
        </div>
        <span className="text-sm font-semibold tracking-tight">Errorfinder</span>
      </div>

      <nav className="md:hidden ml-auto flex items-center gap-1">
        {MOBILE_NAV.map((item) => {
          const Icon = item.icon;
          const active = item.match(pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors focus-ring',
                active
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
              aria-current={active ? 'page' : undefined}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="hidden md:flex flex-1 items-center">
        <PageTitle pathname={pathname} />
      </div>

      <div className="hidden md:block">
        <ThemeToggle />
      </div>
      <div className="md:hidden ml-1">
        <ThemeToggle />
      </div>
    </header>
  );
};

const PageTitle = ({ pathname }: { pathname: string }) => {
  if (pathname === '/') {
    return (
      <div>
        <h1 className="text-sm font-semibold tracking-tight">Verify a response</h1>
        <p className="text-xs text-muted-foreground">Decompose into atomic claims and verify against evidence.</p>
      </div>
    );
  }
  if (pathname === '/runs') {
    return (
      <div>
        <h1 className="text-sm font-semibold tracking-tight">Run history</h1>
        <p className="text-xs text-muted-foreground">Verification runs from this device.</p>
      </div>
    );
  }
  if (pathname.startsWith('/runs/')) {
    return (
      <div>
        <h1 className="text-sm font-semibold tracking-tight">Run detail</h1>
        <p className="text-xs text-muted-foreground">Claim-level verdicts and evidence.</p>
      </div>
    );
  }
  return null;
};
