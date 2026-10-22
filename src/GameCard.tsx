import { useId } from 'react';
import type { Ref } from 'react';
import type { Locale } from './i18n';
import './game-card.css';

/** Shared visual card for the host game and its fixed public sample. */
export function GameCard({ kind, content, locale, revealed, disabled = false, onReveal, buttonRef, className = '' }: {
  kind: 'question' | 'condition'; content: string; locale: Locale; revealed: boolean;
  disabled?: boolean; onReveal: () => void; buttonRef?: Ref<HTMLButtonElement>; className?: string;
}) {
  const contentId = useId();
  const ar = locale === 'ar';
  const label = ar ? (kind === 'question' ? 'سؤال' : 'شرط') : (kind === 'question' ? 'Question' : 'Condition');
  const mark = (position: 'top' | 'bottom') => <img className={`mg-corner mg-corner-${position}`} src="/assets/bud-emblem.svg" width="32" height="23" alt="" />;
  return <button ref={buttonRef} dir={ar ? 'rtl' : 'ltr'} type="button" className={`mg-card mg-card--${kind} ${className}`} data-revealed={revealed} aria-label={`${ar ? 'اكشف' : 'Reveal'} ${label}`} aria-pressed={revealed} aria-describedby={revealed ? contentId : undefined} disabled={revealed || disabled} onClick={onReveal}>
    <span className="mg-flip-inner">
      <span className="mg-card-face mg-card-hidden" aria-hidden={revealed}>{mark('top')}<span className="mg-hidden-center"><b>{kind === 'question' ? 'Q' : 'C'}</b><span>{label}</span></span>{mark('bottom')}</span>
      <span className="mg-card-face mg-card-visible" aria-hidden={!revealed}><span className="mg-face-title">{ar ? `بطاقة ${label}` : label}</span>{mark('top')}<strong className="mg-card-content" id={contentId}>{content}</strong><span className="mg-face-footer">{label}</span>{mark('bottom')}</span>
    </span>
  </button>;
}
