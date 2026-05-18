import type { ReactNode } from 'react';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { AuthedHeader } from '@/components/layout/authed-header';
import { RequireAuth } from '@/features/auth/route-guard';

export default function AuthedLayout({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <div className="relative flex min-h-screen w-full bg-background">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-aurora opacity-40" aria-hidden />
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <AuthedHeader />
          <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
            <div className="mx-auto w-full max-w-6xl">{children}</div>
          </main>
        </div>
      </div>
    </RequireAuth>
  );
}
