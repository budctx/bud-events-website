// Adapted from Magic UI Magic Card (MIT): https://magicui.design/r/magic-card.json
// Light-only BU’D palette; mouse-only gradient mode, no global listeners or theme dependency.
import type {PointerEvent,ReactNode} from 'react';
import {motion,useMotionTemplate,useMotionValue,useReducedMotion} from 'motion/react';

export function MagicCard({children}:{children:ReactNode}){
 const x=useMotionValue(-300),y=useMotionValue(-300),reduced=useReducedMotion();
 const reset=()=>{x.set(-300);y.set(-300);};
 const move=(event:PointerEvent<HTMLDivElement>)=>{
  if(reduced||event.pointerType!=='mouse')return;
  const rect=event.currentTarget.getBoundingClientRect();x.set(event.clientX-rect.left);y.set(event.clientY-rect.top);
 };
 const border=useMotionTemplate`radial-gradient(240px circle at ${x}px ${y}px,#fbb03b,#e7c47e 45%,#d7d1c7 100%)`;
 const glow=useMotionTemplate`radial-gradient(240px circle at ${x}px ${y}px,#fbb03b26,transparent 100%)`;
 return <motion.div className="bud-magic-card" onPointerMove={move} onPointerLeave={reset} onPointerCancel={reset} style={{background:border}}>
  <div className="bud-magic-surface" aria-hidden="true"/>
  <motion.div className="bud-magic-glow" aria-hidden="true" style={{background:glow}}/>
  <div className="bud-magic-content">{children}</div>
 </motion.div>;
}
