'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { authApi, type AuthUser } from '@/features/auth/api';

const STORAGE_KEY = 'shienai.auth.v1';

interface StoredAuth {
  token: string;
  user: AuthUser;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (token: string, user: AuthUser) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const readStored = (): StoredAuth | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredAuth;
    if (
      typeof parsed.token !== 'string' ||
      typeof parsed.user?.id !== 'string' ||
      typeof parsed.user?.email !== 'string'
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

const writeStored = (value: StoredAuth | null): void => {
  if (typeof window === 'undefined') return;
  if (!value) window.localStorage.removeItem(STORAGE_KEY);
  else window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<StoredAuth | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const stored = readStored();
    if (!stored) {
      setIsLoading(false);
      return;
    }
    setState(stored);
    authApi
      .me(stored.token)
      .then((user) => {
        const next = { token: stored.token, user };
        setState(next);
        writeStored(next);
      })
      .catch(() => {
        writeStored(null);
        setState(null);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback((token: string, user: AuthUser) => {
    const next = { token, user };
    setState(next);
    writeStored(next);
  }, []);

  const logout = useCallback(() => {
    setState(null);
    writeStored(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: state?.user ?? null,
      token: state?.token ?? null,
      isLoading,
      isAuthenticated: state !== null,
      login,
      logout,
    }),
    [state, isLoading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
};
