import {useCallback,useEffect,useRef,useState} from 'react';
import {X} from 'lucide-react';
import {ButtonUtility} from './ButtonUtility';
import HostPortal from './HostPortal';
import type {HostEvent,Locale} from './host-client';
import './section-controls.css';
export default function EventSetupModal({onClose,onPlay,onAuthLost,locale}:{onClose:()=>void;onPlay:(event:HostEvent)=>void;onAuthLost:()=>void;locale:Locale}){
 const dialog=useRef<HTMLDialogElement>(null),blocked=useRef(false),[closeBlocked,setCloseBlocked]=useState(false);
 const blocking=useCallback((value:boolean)=>{blocked.current=value;setCloseBlocked(value);},[]);
 const close=()=>{if(!blocked.current)onClose();};
 useEffect(()=>{const node=dialog.current;if(!node)return;const previous=document.activeElement as HTMLElement|null,overflow=document.body.style.overflow;
  node.showModal();document.body.style.overflow='hidden';node.querySelector<HTMLElement>('.host-heading h1')?.focus({preventScroll:true});
  return()=>{node.close();document.body.style.overflow=overflow;if(previous?.isConnected)previous.focus({preventScroll:true});};
 },[]);
 return <dialog ref={dialog} dir="rtl" className="bud-event-setup-modal" aria-label="إعداد الفعالية" onCancel={e=>{e.preventDefault();close();}} onClick={e=>{if(e.target!==e.currentTarget)return;const r=e.currentTarget.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close();}} onKeyDown={e=>{
  if(e.key!=='Tab')return;const items=Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),a[href],[tabindex="0"]')).filter(el=>el.getClientRects().length&&!el.matches(':disabled'));
  const first=items[0],last=items.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
 }}>
 <div className="bud-setup-close"><ButtonUtility label="إغلاق إعداد الفعالية" icon={X} isDisabled={closeBlocked} onPress={close}/></div>
 <HostPortal view="setup" locale={locale} onExit={close} onPlay={onPlay} onAuthLost={onAuthLost} onBlockingChange={blocking}/>
 </dialog>;
}
