import './input-modality.css';
/** Keep semantic focus for dialogs/assistive technology; only keyboard input shows it. */
export function trackInputModality(){
 const root=document.documentElement;
 root.dataset.budInput=matchMedia('(hover:none) and (pointer:coarse)').matches?'touch':'pointer';
 const pointer=(event:PointerEvent)=>{root.dataset.budInput=event.pointerType==='touch'?'touch':'pointer';};
 const keyboard=(event:KeyboardEvent)=>{if(['Tab','Enter',' ','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','End'].includes(event.key))root.dataset.budInput='keyboard';};
 document.addEventListener('pointerdown',pointer,true);document.addEventListener('keydown',keyboard,true);
 return()=>{document.removeEventListener('pointerdown',pointer,true);document.removeEventListener('keydown',keyboard,true);};
}
export function touchInputActive(){return document.documentElement.dataset.budInput==='touch';}
