import { useEffect, useState } from 'react';
import type { ManualWinner } from './manual-game';
import type { Locale } from './i18n';
import { WinnerIcon, WinnerNumber } from './WinnerList';
import { PrizeConfetti } from './PrizeConfetti';

export const prizeRevealDurationMs = 1250;

export function PrizeReveal({ name, winner, locale, celebration, onClose }: { name: string; winner: ManualWinner; locale: Locale; celebration: boolean; onClose: () => void }) {
  const [revealed, setRevealed] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const ar = locale === 'ar';
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const reduce = () => { if (media.matches) setRevealed(true); };
    const timer = window.setTimeout(() => setRevealed(true), prizeRevealDurationMs);
    media.addEventListener('change', reduce);
    return () => { clearTimeout(timer); media.removeEventListener('change', reduce); };
  }, []);
  return <div className="mg-reveal-experience" data-stage={revealed ? 'revealed' : 'anticipation'}>
    {revealed && <PrizeConfetti enabled={celebration} />}
    <p className="mg-result-winner"><strong dir="auto">{winner.name}</strong> <WinnerNumber id={winner.id} /></p>
    {!revealed ? <div className="mg-anticipation"><span className="mg-gift-aura" /><span className="mg-gift-box"><WinnerIcon kind="gift" /></span><p role="status">{ar ? 'لحظة… جائزتك تقترب!' : 'One moment… your prize is coming!'}</p><span className="mg-reveal-dots" aria-hidden="true"><i /><i /><i /></span></div> : <div className="mg-revealed-content"><div className="mg-result-trophy"><WinnerIcon kind="trophy" /></div><p className="mg-congratulations" role="status">{ar ? 'مبروك الفوز!' : 'Congratulations!'}</p><div className="mg-result-prize" dir="auto">{name}</div></div>}
    <button className="mg-button mg-primary" autoFocus data-autofocus onClick={() => revealed ? onClose() : setRevealed(true)}>{revealed ? (ar ? 'متابعة السحب' : 'Continue draw') : (ar ? 'اكشف الآن' : 'Reveal now')}</button>
  </div>;
}
