'use client';

import { Moon, Sun, Monitor } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState, type ReactElement } from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const NEXT_THEME: Record<string, string> = {
  light: 'dark',
  dark: 'system',
  system: 'light',
};

const ICON: Record<string, ReactElement> = {
  light: <Sun aria-hidden />,
  dark: <Moon aria-hidden />,
  system: <Monitor aria-hidden />,
};

export const ThemeToggle = () => {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const current = (theme ?? 'system') as keyof typeof ICON;
  const next = (NEXT_THEME[current] ?? 'light') as keyof typeof ICON;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={mounted ? `Switch to ${next} theme` : 'Switch theme'}
          onClick={() => setTheme(next)}
        >
          {mounted ? ICON[current] : <Monitor aria-hidden />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{mounted ? `Theme: ${current}` : 'Theme'}</TooltipContent>
    </Tooltip>
  );
};
