'use client';

import { History, LogOut, MessageSquare, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ShienAiWordmark } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/context';
import { cn } from '@/lib/utils';

const MOBILE_NAV = [
  { href: '/app/evaluation', label: 'Evaluation', icon: ShieldCheck, match: (p: string) => p === '/app/evaluation' },
  { href: '/app/chat', label: 'Chat', icon: MessageSquare, match: (p: string) => p === '/app/chat' || p.startsWith('/app/chat/') },
  { href: '/app/history', label: 'History', icon: History, match: (p: string) => p === '/app/history' || p.startsWith('/app/history/') },
];

const titleFor = (pathname: string) => {
  if (pathname === '/app/evaluation' || pathname === '/app') {
    return { title: 'Evaluation', subtitle: 'Decompose responses into atomic claims and verify against evidence.' };
  }
  if (pathname === '/app/chat') {
    return { title: 'Chat', subtitle: 'Ask a question and verify the answer in real time.' };
  }
  if (pathname === '/app/history') {
    return { title: 'History', subtitle: 'Verification runs from this device.' };
  }
  if (pathname.startsWith('/app/history/')) {
    return { title: 'Run detail', subtitle: 'Claim-level verdicts and evidence.' };
  }
  return null;
};

export const AuthedHeader = () => {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const title = titleFor(pathname);

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border/40 bg-background/70 backdrop-blur px-4 md:px-6">
      <div className="flex items-center gap-2 md:hidden">
        <ShienAiWordmark />
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
                active ? 'bg-primary/20 text-foreground' : 'text-muted-foreground hover:text-foreground',
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
        {title ? (
          <div>
            <h1 className="text-sm font-semibold tracking-tight">{title.title}</h1>
            <p className="text-xs text-muted-foreground">{title.subtitle}</p>
          </div>
        ) : null}
      </div>

      <div className="ml-auto flex items-center gap-3 md:ml-0">
        {user ? (
          <span className="hidden sm:inline-flex items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary/20 text-[11px] font-semibold uppercase text-foreground">
              {user.name.slice(0, 1)}
            </span>
            <span className="hidden md:inline">{user.name}</span>
          </span>
        ) : null}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          className="gap-1.5 text-muted-foreground hover:text-foreground"
        >
          <LogOut className="h-3.5 w-3.5" aria-hidden />
          <span className="hidden sm:inline">Sign out</span>
        </Button>
      </div>
    </header>
  );
};
