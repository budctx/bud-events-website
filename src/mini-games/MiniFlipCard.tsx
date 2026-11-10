import {motion,useReducedMotion} from 'motion/react';

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
  disabled={disabled} onClick={onPress} data-revealed={revealed?'true':'false'}>
  <motion.span className="mini-flip-inner" initial={false} animate={{rotateY:revealed?180:0}}
   transition={{duration:reducedMotion?0:0.56,ease:[0.22,0.8,0.25,1]}}>
   <span className="mini-flip-face mini-flip-back" aria-hidden="true">{back}</span>
   <span className="mini-flip-face mini-flip-front" aria-hidden="true">{front}</span>
  </motion.span>
 </button>;
}
