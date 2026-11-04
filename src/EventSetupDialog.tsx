import {useEffect,useRef} from 'react';
import type {ReactNode} from 'react';
import {X} from 'lucide-react';
import {ButtonUtility} from './ButtonUtility';
import './section-controls.css';

/** One accessible modal shell for all BU'D host event setup forms. */
export function EventSetupDialog({title,onClose,closeDisabled=false,children}:{title:string;onClose:()=>void;closeDisabled?:boolean;children:ReactNode}){
 const dialog=useRef<HTMLDialogElement>(null);
 const close=()=>{if(!closeDisabled)onClose();};
 useEffect(()=>{
  const node=dialog.current;if(!node)return;
  const previous=document.activeElement as HTMLElement|null;
  const overflow=document.body.style.overflow;
  node.showModal();document.body.style.overflow='hidden';
  // Focus the heading, not a text field: iOS must not open its keyboard on entry.
  node.querySelector<HTMLElement>('.host-heading h1[tabindex="-1"]')?.focus({preventScroll:true});
  return()=>{node.close();document.body.style.overflow=overflow;if(previous?.isConnected)previous.focus({preventScroll:true});};
 },[]);
 return <dialog ref={dialog} dir="rtl" lang="ar" className="bud-event-setup-modal" aria-label={title}
  onCancel={e=>{e.preventDefault();close();}}
  onClick={e=>{if(e.target!==e.currentTarget)return;const r=e.currentTarget.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close();}}
  onKeyDown={e=>{
   if(e.key!=='Tab')return;
   const items=Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),a[href],[tabindex="0"]')).filter(el=>el.getClientRects().length&&!el.matches(':disabled'));
   const first=items[0],last=items.at(-1);
   if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}
   else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
  }}>
  <div className="bud-setup-close"><ButtonUtility label="إغلاق إعداد الفعالية" icon={X} isDisabled={closeDisabled} onPress={close}/></div>
  {children}
 </dialog>;
}
