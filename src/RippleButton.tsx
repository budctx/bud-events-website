// Adapted from Magic UI Ripple Button (MIT). See licenses/magicui-MIT.txt.
import {useCallback,useEffect,useRef,useState} from 'react';
import type {ButtonHTMLAttributes,MouseEvent} from 'react';
import './purchase-button.css';

type Ripple={id:number;x:number;y:number;size:number};
function Wave({ripple,onDone}:{ripple:Ripple;onDone:(id:number)=>void}){
 useEffect(()=>{const timer=window.setTimeout(()=>onDone(ripple.id),600);return()=>window.clearTimeout(timer);},[ripple.id,onDone]);
 return <span className="bud-button-wave" style={{width:ripple.size,height:ripple.size,left:ripple.x,top:ripple.y}}/>;
}
export function RippleButton({children,className='',onClick,...props}:ButtonHTMLAttributes<HTMLButtonElement>){
 const [ripples,setRipples]=useState<Ripple[]>([]),nextId=useRef(0);
 const remove=useCallback((id:number)=>setRipples(previous=>previous.filter(ripple=>ripple.id!==id)),[]);
 const click=(event:MouseEvent<HTMLButtonElement>)=>{
  if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches){
   const rect=event.currentTarget.getBoundingClientRect(),size=Math.hypot(rect.width,rect.height)*2;
   const x=event.detail===0?rect.width/2:event.clientX-rect.left,y=event.detail===0?rect.height/2:event.clientY-rect.top;
   setRipples(previous=>[...previous.slice(-3),{id:++nextId.current,x:x-size/2,y:y-size/2,size}]);
  }
  onClick?.(event);
 };
 return <button {...props} type={props.type??'button'} className={'bud-ripple-button '+className} onClick={click}>
  <span className="bud-ripple-content">{children}</span>
  <span className="bud-button-waves" aria-hidden="true">{ripples.map(ripple=><Wave key={ripple.id} ripple={ripple} onDone={remove}/>)}</span>
 </button>;
}
