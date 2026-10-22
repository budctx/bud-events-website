import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';

export const celebrationConfig = { durationMs: 3200, particleCount: 88 };

/** Lives inside the result dialog so confetti is visible above the native backdrop. */
export function PrizeConfetti({ enabled }: { enabled: boolean }) {
  const [active, setActive] = useState(false);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const startedAt = Date.now();
    const update = () => setActive(enabled && !media.matches && Date.now() - startedAt < celebrationConfig.durationMs);
    update();
    media.addEventListener('change', update);
    const timeout = window.setTimeout(() => setActive(false), celebrationConfig.durationMs);
    return () => { clearTimeout(timeout); media.removeEventListener('change', update); };
  }, [enabled]);
  if (!active) return null;
  const colors = ['#fbb03b', '#66b8d8', '#b679e1', '#ed7696', '#85cb68', '#e1d647'];
  return <span className="mg-confetti" aria-hidden="true">{Array.from({ length: celebrationConfig.particleCount }, (_, i) => <i key={i} style={{ '--x': `${(i * 37) % 100}%`, '--delay': `${(i % 13) * 40}ms`, '--drift': `${((i * 53) % 240) - 120}px`, '--spin': `${i % 2 ? 620 : -540}deg`, '--color': colors[i % colors.length], '--fall': `${celebrationConfig.durationMs - 560}ms` } as CSSProperties} />)}</span>;
}
