import type { CSSProperties } from 'react';

/**
 * The hero's moving scene: a night skyline, light trails sweeping past and an
 * illustrated (not photographed) executive car gliding in. It is deliberately an
 * illustration: RideWELL shows real photos only of real, approved vehicles, which
 * can replace this once they exist.
 */
export function HeroScene() {
  const trails = [
    { y: '28%', d: '0s' },
    { y: '52%', d: '0.9s', cool: true },
    { y: '66%', d: '1.6s' },
    { y: '40%', d: '2.2s', cool: true },
    { y: '78%', d: '0.4s' },
  ];
  return (
    <>
      <svg className="hero-skyline" viewBox="0 0 1440 200" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#1b1f27" />
            <stop offset="1" stopColor="#0b0c10" />
          </linearGradient>
        </defs>
        {/* Rolling hills with a city on them: Kigali at night */}
        <path
          fill="url(#sky)"
          d="M0 150 C120 120 220 125 320 110 L320 70 L340 70 L340 95 L360 95 L360 55 L385 55 L385 98 L420 98 L420 80 L440 80 L440 105 C560 90 640 100 720 88 L720 60 L735 60 L735 40 L752 40 L752 62 L770 62 L770 92 C880 84 960 96 1040 86 L1040 66 L1062 66 L1062 90 L1090 90 L1090 50 L1110 50 L1110 92 C1220 98 1320 120 1440 112 L1440 200 L0 200 Z"
        />
        {[350, 372, 395, 428, 742, 760, 1050, 1098, 1100].map((x, i) => (
          <rect key={i} x={x} y={60 + (i % 3) * 12} width="3" height="3" fill="#f2b33d" opacity={0.55} />
        ))}
      </svg>
      <div className="trails" aria-hidden="true">
        {trails.map((t, i) => (
          <span key={i} className={`trail ${t.cool ? 'cool' : ''}`} style={{ '--y': t.y, '--d': t.d } as CSSProperties} />
        ))}
      </div>
      <div className="hero-road" aria-hidden="true" />
      <svg className="hero-car" viewBox="0 0 900 320" aria-hidden="true">
        <defs>
          <linearGradient id="body" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#3a4150" />
            <stop offset="0.45" stopColor="#151820" />
            <stop offset="1" stopColor="#07080b" />
          </linearGradient>
          <linearGradient id="glass" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#5b6577" stopOpacity="0.85" />
            <stop offset="1" stopColor="#0d1015" stopOpacity="0.95" />
          </linearGradient>
          <linearGradient id="shine" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#fff" stopOpacity="0" />
            <stop offset="0.5" stopColor="#fff" stopOpacity="0.55" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <radialGradient id="beamGrad" cx="0" cy="0.5" r="1">
            <stop offset="0" stopColor="#fff6e0" stopOpacity="0.9" />
            <stop offset="1" stopColor="#fff6e0" stopOpacity="0" />
          </radialGradient>
          <filter id="soft" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="14" />
          </filter>
          <radialGradient id="shadow" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#000" stopOpacity="0.8" />
            <stop offset="1" stopColor="#000" stopOpacity="0" />
          </radialGradient>
        </defs>
        <ellipse cx="450" cy="292" rx="400" ry="22" fill="url(#shadow)" />
        <g className="float">
          {/* headlight beam */}
          <path className="headlight" d="M95 208 L-120 150 L-120 275 Z" fill="url(#beamGrad)" opacity="0.7" filter="url(#soft)" />
          {/* body */}
          <path
            fill="url(#body)"
            stroke="#2b313c"
            strokeWidth="1.5"
            d="M60 230 C60 205 80 192 120 186 L250 170 C300 128 360 98 450 94 L590 96 C650 100 700 128 748 168 L820 180 C858 186 872 205 870 232 L866 248 C864 258 856 262 846 262 L760 262 C756 222 730 198 690 198 C650 198 624 222 620 262 L300 262 C296 222 270 198 230 198 C190 198 164 222 160 262 L84 262 C70 262 62 252 60 240 Z"
          />
          {/* glasshouse */}
          <path fill="url(#glass)" d="M270 170 C318 132 370 110 452 107 L572 108 C622 112 668 136 706 168 Z" />
          <path d="M488 108 L478 170" stroke="#0a0c10" strokeWidth="7" />
          {/* shoulder line + reflection */}
          <path d="M110 200 C300 182 600 178 850 196" stroke="url(#shine)" strokeWidth="2" fill="none" />
          <path d="M150 226 L820 226" stroke="#000" strokeOpacity="0.35" strokeWidth="1.5" />
          {/* lights */}
          <path d="M66 208 L118 200 L116 214 L70 220 Z" fill="#fff4d6" />
          <path d="M846 196 L870 206 L868 222 L842 214 Z" fill="#ff3b30" />
          <path d="M846 196 L870 206 L868 222 L842 214 Z" fill="#ff3b30" opacity="0.6" filter="blur(6px)" />
          {/* wheels */}
          {[230, 690].map((cx) => (
            <g key={cx}>
              <circle cx={cx} cy="262" r="50" fill="#050608" />
              <circle cx={cx} cy="262" r="38" fill="#1c2028" stroke="#3b4250" strokeWidth="2" />
              <g className="wheel">
                {[0, 72, 144, 216, 288].map((a) => (
                  <rect key={a} x={cx - 3} y={262 - 34} width="6" height="30" rx="3" fill="#596273" transform={`rotate(${a} ${cx} 262)`} />
                ))}
              </g>
              <circle cx={cx} cy="262" r="8" fill="#9aa3b2" />
            </g>
          ))}
        </g>
      </svg>
    </>
  );
}
