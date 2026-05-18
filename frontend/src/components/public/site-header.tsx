'use client';

import Link from 'next/link';
import { ShienAiWordmark } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/context';

const NAV = [
  { href: '#platform', label: 'Platform' },
  { href: '#solutions', label: 'Solutions' },
  { href: '#api', label: 'API' },
  { href: '#pricing', label: 'Pricing' },
];

export const SiteHeader = () => {
  const { isAuthenticated } = useAuth();

  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-md bg-background/60 border-b border-border/40">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 md:px-6">
        <Link href="/" className="focus-ring rounded-md">
          <ShienAiWordmark />
        </Link>

        <nav className="hidden md:flex items-center gap-7 text-sm text-muted-foreground">
          {NAV.map((n) => (
            <a key={n.href} href={n.href} className="hover:text-foreground transition-colors">
              {n.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {isAuthenticated ? (
            <Button asChild className="rounded-full">
              <Link href="/app/evaluation">Open app</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" className="hidden sm:inline-flex">
                <Link href="/login">Sign in</Link>
              </Button>
              <Button asChild variant="outline" className="rounded-full border-border/60">
                <Link href="/register">Request Demo</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
