import {motion,useReducedMotion} from 'motion/react';
import type {CSSProperties} from 'react';

// Shared animation contract with the host completion overlay and bomb suspense.
export const MINI_FLIP_DURATION_MS=560;
export const MINI_FLIP_RESULT_HOLD_MS=1200;
export const MINI_FLIP_RESULT_DELAY_MS=MINI_FLIP_DURATION_MS+MINI_FLIP_RESULT_HOLD_MS;

/**
 * Reusable accessible 3D card based on the Motion team's documented card-flip
 * composition (perspective, preserve-3d, backface-visibility, rotateY).
 * The card's content and game state still come exclusively from the BU'D engine.
 * Reference: https://motion.dev/docs/3d-transforms
 */
type Props={
 className:string;
 revealed:boolean;
 disabled:boolean;
 label:string;
 back:string;
 front:string;
 onPress:()=>void;
};
export function MiniFlipCard({className,revealed,disabled,label,back,front,onPress}:Props){
 const reducedMotion=useReducedMotion();
 return <button type="button" className={className+' mini-flip-card'} aria-label={label}
  disabled={disabled} onClick={onPress} data-revealed={revealed?'true':'false'}
  style={{'--mini-flip-duration':`${MINI_FLIP_DURATION_MS}ms`} as CSSProperties}>
  <motion.span className="mini-flip-inner" initial={false} animate={{rotateY:revealed?180:0}}
   transition={{duration:reducedMotion?0:MINI_FLIP_DURATION_MS/1000,ease:[0.22,0.8,0.25,1]}}>
   <span className="mini-flip-face mini-flip-back" aria-hidden="true">{back}</span>
   <span className="mini-flip-face mini-flip-front" aria-hidden="true">{front}</span>
  </motion.span>
 </button>;
}
