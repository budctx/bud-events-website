import type { ReactNode } from 'react';
type Props = {
  kind: 'question' | 'condition' | 'prize'; revealed: boolean;
  front: ReactNode; back: ReactNode;
  onReveal?: () => void; revealLabel?: string; disabled?: boolean;
};
/** Figma-aligned, full-card keyboard activation. */
export function PlayingCard({kind, revealed, front, back, onReveal, revealLabel, disabled = false}: Props) {
  const className = `playing-card playing-card--${kind}${onReveal ? ' playing-card--interactive' : ''}`;
  const faces = <span className="flip-inner">
    <span className="card-face card-face--front" aria-hidden={revealed} inert={revealed}>{front}</span>
    <span className="card-face card-face--back" aria-hidden={!revealed} inert={!revealed}>{back}</span>
  </span>;
  return onReveal
    ? <button type="button" className={className} data-revealed={revealed}
        aria-label={revealLabel} disabled={disabled || revealed} onClick={onReveal}>{faces}</button>
    : <span className={className} data-revealed={revealed}>{faces}</span>;
}
