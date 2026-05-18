import type { ReactNode } from 'react';
import { ShienAiWordmark } from '@/components/brand/logo';

interface AuthCardProps {
  title: string;
  description: string;
  footer?: ReactNode;
  children: ReactNode;
}

export const AuthCard = ({ title, description, footer, children }: AuthCardProps) => (
  <div className="mx-auto flex min-h-[80vh] max-w-md flex-col items-center justify-center px-4 py-12">
    <div className="mb-6">
      <ShienAiWordmark />
    </div>
    <div className="w-full rounded-2xl border border-border/60 bg-card/70 p-7 shadow-xl backdrop-blur-md ring-glow">
      <div className="mb-6 text-center">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
    {footer ? <div className="mt-5 text-sm text-muted-foreground">{footer}</div> : null}
  </div>
);
