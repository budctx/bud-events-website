import {motion,useReducedMotion} from 'motion/react';
import type {CSSProperties} from 'react';

// Shared animation contract with the host completion overlay and bomb suspense.
export const MINI_FLIP_DURATION_MS=560;
export const MINI_FLIP_RESULT_HOLD_MS=1200;
export const MINI_FLIP_RESULT_DELAY_MS=MINI_FLIP_DURATION_MS+MINI_FLIP_RESULT_HOLD_MS;

/**
 * The whole physical button (border, shadow and both faces) rotates, not only
 * an inset beige surface. The transparent outer span supplies local perspective
 * and never looks like a second, stationary card frame.
 *
 * Source: https://motion.dev/docs/3d-transforms
 */
type Props={
 className:string;
 revealed:boolean;
 disabled:boolean;
 label:string;
 back:string;
 front:string;
 explode?:boolean;
 onPress:()=>void;
};
export function MiniFlipCard({className,revealed,disabled,label,back,front,explode=false,onPress}:Props){
 const reducedMotion=useReducedMotion();
 return <span className={'mini-flip-stage'+(explode?' is-exploding':'')}
  style={{'--mini-flip-duration':`${MINI_FLIP_DURATION_MS}ms`} as CSSProperties}>
  <motion.button type="button" className={className+' mini-flip-card'} aria-label={label}
   disabled={disabled} onClick={onPress} data-revealed={revealed?'true':'false'}
   initial={false} animate={{rotateY:revealed?180:0}}
   whileHover={disabled?undefined:{y:-2}}
   transition={{duration:reducedMotion?0:MINI_FLIP_DURATION_MS/1000,ease:[0.22,0.8,0.25,1]}}>
   <span className="mini-flip-face mini-flip-back" aria-hidden="true">{back}</span>
   <span className="mini-flip-face mini-flip-front" aria-hidden="true">{front}</span>
  </motion.button>
 </span>;
}
