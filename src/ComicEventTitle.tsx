import {motion,useReducedMotion} from 'motion/react';
import './comic-event-title.css';
// Adapted from Magic UI Comic Text (MIT); keep Arabic shaping intact.
export function ComicEventTitle({children}:{children:string}){
 const reduced=useReducedMotion();
 return <motion.span className="bud-comic-title" initial={reduced?false:{opacity:0,scale:.8,rotate:-2}} animate={{opacity:1,scale:1,rotate:0}} transition={{duration:.6,type:'spring',bounce:.25}}>{children}</motion.span>;
}
