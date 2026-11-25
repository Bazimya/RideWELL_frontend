import type { SVGProps } from 'react';

const base = (p: SVGProps<SVGSVGElement>) => ({
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  ...p,
});

export const BrandMark = (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 32 32" className="brand-mark" aria-hidden="true" {...p}>
    <defs>
      <linearGradient id="bm" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#ff4a3d" />
        <stop offset="1" stopColor="#b5121c" />
      </linearGradient>
    </defs>
    <rect width="32" height="32" rx="9" fill="url(#bm)" />
    <path d="M8 21.5 C11 13 21 13 24 21.5" stroke="#fff" strokeWidth="2.6" fill="none" strokeLinecap="round" />
    <circle cx="16" cy="12" r="2.4" fill="#fff" />
  </svg>
);

export const IconShield = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M12 3l7 3v6c0 4.5-3 7.7-7 9-4-1.3-7-4.5-7-9V6z" />
    <path d="M9 12l2 2 4-4" />
  </svg>
);
export const IconSteering = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="2" />
    <path d="M3.5 10.5h6.5M14 10.5h6.5M12 14v7" />
  </svg>
);
export const IconPlane = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M10.5 13.5L3 11l1.5-1.5 7.5 1 4-4.5c1-1 2.6-1.3 3.3-.6.7.7.4 2.3-.6 3.3L14.2 12.7l1 7.5L13.7 21.7l-2.5-7.5" />
  </svg>
);
export const IconPhone = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <rect x="6.5" y="2.5" width="11" height="19" rx="2.5" />
    <path d="M11 18h2" />
  </svg>
);
export const IconPin = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M12 21s-7-6.2-7-11.5a7 7 0 0114 0C19 14.8 12 21 12 21z" />
    <circle cx="12" cy="9.5" r="2.5" />
  </svg>
);
export const IconClock = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);
export const IconChat = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M4 5h16v11H9l-5 4z" />
  </svg>
);
export const IconUpload = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3" />
  </svg>
);
export const IconFile = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M6 3h8l4 4v14H6z" />
    <path d="M14 3v4h4" />
  </svg>
);
export const IconCar = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M3 15l1.5-5A2 2 0 016.4 8.5h11.2a2 2 0 011.9 1.5L21 15v3h-2.5M3 15v3h2.5M3 15h18" />
    <circle cx="7" cy="18" r="1.8" />
    <circle cx="17" cy="18" r="1.8" />
  </svg>
);
export const IconArrow = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)} className={`arrow ${p.className ?? ''}`}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);
