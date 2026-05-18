import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  size?: number;
}

export const ShienAiLogo = ({ className, size = 28 }: LogoProps) => (
  <span
    className={cn('inline-flex items-center justify-center rounded-xl', className)}
    style={{ width: size, height: size }}
    aria-hidden
  >
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="shienai-grad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#a78bfa" />
          <stop offset="60%" stopColor="#8b5cf6" />
          <stop offset="100%" stopColor="#6366f1" />
        </linearGradient>
      </defs>
      <path
        d="M16 2.5L28.5 9.5V22.5L16 29.5L3.5 22.5V9.5L16 2.5Z"
        stroke="url(#shienai-grad)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M11 12L16 9L21 12V19L16 22L11 19V12Z"
        fill="url(#shienai-grad)"
        opacity="0.85"
      />
    </svg>
  </span>
);

export const ShienAiWordmark = ({ className }: { className?: string }) => (
  <span className={cn('inline-flex items-center gap-2', className)}>
    <ShienAiLogo />
    <span className="text-base font-semibold tracking-tight">Shien Ai</span>
  </span>
);
