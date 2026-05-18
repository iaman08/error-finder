'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { AuthCard } from '@/components/auth/auth-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authApi, type AuthApiError } from '@/features/auth/api';
import { useAuth } from '@/features/auth/context';
import { RedirectIfAuthed } from '@/features/auth/route-guard';

export default function LoginPage() {
  return (
    <RedirectIfAuthed>
      <LoginInner />
    </RedirectIfAuthed>
  );
}

const LoginInner = () => {
  const router = useRouter();
  const search = useSearchParams();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await authApi.login({ email, password });
      login(result.token, result.user);
      const next = search.get('next');
      router.push(next && next.startsWith('/app/') ? next : '/app/evaluation');
    } catch (err) {
      const apiErr = err as AuthApiError;
      setError(apiErr.message ?? 'Login failed');
      setSubmitting(false);
    }
  };

  return (
    <AuthCard
      title="Welcome back"
      description="Sign in to access your evaluation workspace."
      footer={
        <span>
          Don&apos;t have an account?{' '}
          <Link href="/register" className="font-medium text-foreground hover:underline">
            Create one
          </Link>
        </span>
      }
    >
      <form className="space-y-4" onSubmit={handleSubmit} noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            disabled={submitting}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            disabled={submitting}
          />
        </div>
        {error ? <p className="text-sm text-destructive-foreground">{error}</p> : null}
        <Button type="submit" disabled={submitting} className="w-full">
          {submitting ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </AuthCard>
  );
};
