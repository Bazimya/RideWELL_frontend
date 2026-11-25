import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ElementType, type ReactNode } from 'react';

/**
 * Fades and lifts its content into place the first time it scrolls into view.
 * `index` staggers siblings. Content is visible without JavaScript-driven
 * animation for reduced-motion users (CSS handles that).
 */
export function Reveal({
  children,
  index = 0,
  as: Tag = 'div',
  className = '',
  style,
}: {
  children: ReactNode;
  index?: number;
  as?: ElementType;
  className?: string;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        // Reveal on entering view, and also anything already scrolled past (jumps, anchors).
        if (entries.some((e) => e.isIntersecting || e.boundingClientRect.bottom < 0)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.12 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <Tag ref={ref} className={`reveal ${visible ? 'is-visible' : ''} ${className}`} style={{ ...style, '--i': index } as CSSProperties}>
      {children}
    </Tag>
  );
}

/** True once the page has scrolled past `offset` px (header material). */
export function useScrolled(offset = 12): boolean {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > offset);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, [offset]);
  return scrolled;
}

/**
 * Tabs whose highlight slides from the current tab to the new one, measured from
 * the live layout so it starts exactly where it is on screen.
 */
export function SlidingTabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
}: {
  tabs: Array<{ value: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ x: number; w: number } | null>(null);
  useLayoutEffect(() => {
    const measure = () => {
      const el = wrap.current?.querySelector<HTMLButtonElement>(`[data-value="${value}"]`);
      if (el) setBox({ x: el.offsetLeft - 5, w: el.offsetWidth });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [value, tabs.length]);

  return (
    <div className="tabs" role="tablist" aria-label={label} ref={wrap}>
      {box && <span className="indicator" style={{ width: box.w, transform: `translateX(${box.x}px)` }} aria-hidden="true" />}
      {tabs.map((t) => (
        <button
          key={t.value}
          type="button"
          role="tab"
          className="tab"
          data-value={t.value}
          aria-selected={t.value === value}
          onClick={() => onChange(t.value)}
          onKeyDown={(e) => {
            const i = tabs.findIndex((x) => x.value === value);
            if (e.key === 'ArrowRight') onChange(tabs[(i + 1) % tabs.length]!.value);
            if (e.key === 'ArrowLeft') onChange(tabs[(i - 1 + tabs.length) % tabs.length]!.value);
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
