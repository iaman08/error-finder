import { cn } from '@/lib/utils';

interface HeroIllustrationProps {
  className?: string;
}

export const HeroIllustration = ({ className }: HeroIllustrationProps) => (
  <div className={cn('relative aspect-[4/3]', className)} aria-hidden>
    <svg
      viewBox="0 0 600 450"
      className="h-full w-full"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <radialGradient id="aurora-a" cx="20%" cy="30%" r="50%">
          <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#a78bfa" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="aurora-b" cx="80%" cy="20%" r="40%">
          <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="figure-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1e1b4b" />
          <stop offset="100%" stopColor="#312e81" />
        </linearGradient>
        <linearGradient id="mask-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1f2937" />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>
      </defs>

      <rect width="600" height="450" fill="transparent" />

      <ellipse cx="180" cy="160" rx="220" ry="150" fill="url(#aurora-a)" />
      <ellipse cx="460" cy="120" rx="180" ry="130" fill="url(#aurora-b)" />

      {/* scattered geometric particles */}
      <g opacity="0.6" fill="#c4b5fd">
        <circle cx="80" cy="80" r="3" />
        <circle cx="130" cy="220" r="2" />
        <circle cx="540" cy="320" r="2.5" />
        <circle cx="500" cy="60" r="2" />
        <circle cx="60" cy="320" r="2.5" />
        <circle cx="200" cy="40" r="2" />
        <rect x="546" y="200" width="6" height="6" transform="rotate(45 549 203)" opacity="0.6" />
        <rect x="60" y="200" width="6" height="6" transform="rotate(45 63 203)" opacity="0.6" />
        <polygon points="540,180 545,170 550,180" />
        <polygon points="80,170 85,160 90,170" />
      </g>

      {/* x marks */}
      <g stroke="#8b5cf6" strokeWidth="1.5" opacity="0.7" strokeLinecap="round">
        <path d="M520 220 l8 8 M528 220 l-8 8" />
        <path d="M50 130 l6 6 M56 130 l-6 6" />
        <path d="M450 380 l6 6 M456 380 l-6 6" />
      </g>

      {/* abstract person silhouette */}
      <g transform="translate(220 130)">
        {/* shoulders / shirt */}
        <path
          d="M-30 190 Q40 150 110 190 L120 240 L-40 240 Z"
          fill="#e5e7eb"
        />
        {/* neck */}
        <rect x="25" y="150" width="30" height="40" rx="6" fill="#c0aaa0" />
        {/* head */}
        <ellipse cx="40" cy="100" rx="48" ry="58" fill="url(#figure-grad)" opacity="0.95" />
        <ellipse cx="40" cy="100" rx="48" ry="58" fill="#c0aaa0" />
        {/* hair */}
        <path d="M-2 70 Q0 35 40 28 Q82 35 86 78 Q72 56 40 56 Q12 56 -2 70 Z" fill="#1f2937" />
        {/* mask covering eyes */}
        <g transform="translate(0 78)">
          <path
            d="M-2 12 Q40 -8 82 12 L82 36 Q40 50 -2 36 Z"
            fill="url(#mask-grad)"
            stroke="#8b5cf6"
            strokeWidth="1"
            strokeOpacity="0.4"
          />
          {/* mouth slit on mask */}
          <path d="M28 32 Q40 38 52 32" stroke="#a78bfa" strokeWidth="1.5" fill="none" />
          {/* eye holes */}
          <ellipse cx="18" cy="22" rx="6" ry="4" fill="#0f172a" />
          <ellipse cx="62" cy="22" rx="6" ry="4" fill="#0f172a" />
        </g>
      </g>

      {/* swirling aurora ribbon */}
      <path
        d="M40 250 Q150 180 270 230 T540 220"
        stroke="#a78bfa"
        strokeOpacity="0.45"
        strokeWidth="22"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M20 290 Q140 240 290 280 T560 270"
        stroke="#8b5cf6"
        strokeOpacity="0.25"
        strokeWidth="14"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  </div>
);
