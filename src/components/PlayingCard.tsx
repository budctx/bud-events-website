import type { ReactNode } from 'react';
type Props = { kind: 'question' | 'condition' | 'prize'; revealed: boolean; front: ReactNode; back: ReactNode };
/** Faces follow the Figma refinement. Reveal state never waits for transitionend. */
export function PlayingCard({kind, revealed, front, back}: Props) {
  return <span className={`playing-card playing-card--${kind}`} data-revealed={revealed}>
    <span className="flip-inner">
      <span className="card-face card-face--front" aria-hidden={revealed} inert={revealed}>{front}</span>
      <span className="card-face card-face--back" aria-hidden={!revealed} inert={!revealed}>{back}</span>
    </span>
  </span>;
}
