'use client';

import { History, MessageSquare, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShienAiWordmark } from '@/components/brand/logo';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  match: (pathname: string) => boolean;
}

const NAV_ITEMS: NavItem[] = [
  {
    href: '/app/evaluation',
    label: 'Evaluation',
    icon: ShieldCheck,
    match: (p) => p === '/app/evaluation' || p === '/app',
  },
  {
    href: '/app/chat',
    label: 'Chat',
    icon: MessageSquare,
    match: (p) => p === '/app/chat' || p.startsWith('/app/chat/'),
  },
  {
    href: '/app/history',
    label: 'History',
    icon: History,
    match: (p) => p === '/app/history' || p.startsWith('/app/history/'),
  },
];

export const AppSidebar = () => {
  const pathname = usePathname();
  return (
    <aside className="hidden md:flex md:w-60 lg:w-64 shrink-0 flex-col border-r border-border/40 bg-card/40 backdrop-blur-sm">
      <div className="flex h-16 items-center px-5 border-b border-border/40">
        <Link href="/" className="focus-ring rounded-md">
          <ShienAiWordmark />
        </Link>
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
                    'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors focus-ring',
                    active
                      ? 'bg-primary/15 text-foreground font-medium ring-1 ring-primary/30'
                      : 'text-muted-foreground hover:bg-accent/40 hover:text-foreground',
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
      <div className="border-t border-border/40 px-5 py-4">
        <p className="text-xs text-muted-foreground leading-relaxed">
          See clearly in the age of AI. Verify, correct, and trust.
        </p>
      </div>
    </aside>
  );
};
