import {createContext,useCallback,useContext,useEffect,useId,useLayoutEffect,useRef,useState} from 'react';
import type {CSSProperties,PointerEvent,ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {AlertCircle,CheckCircle2,Info,X} from 'lucide-react';
import * as Tooltip from '@radix-ui/react-tooltip';
import './bud-ui.css';

// Shared React implementations of the approved component patterns.
// Motion Core and Melt UI source components are Svelte-only; no Svelte runtime is included.
type Tone='neutral'|'success'|'warning'|'danger'|'info';
type Toast={id:string;text:string;tone:Tone;persistent?:boolean};
type Notify=((text:string,tone?:Tone,options?:{id?:string;persistent?:boolean})=>string)&{dismiss:(id:string)=>void};
const context=createContext<Notify|null>(null);
let sequence=0;
function ToastItem({item,dismiss}:{item:Toast;dismiss:(id:string)=>void}){
 const [paused,setPaused]=useState(false);
 useEffect(()=>{if(paused||item.persistent||item.tone==='danger')return;const timeout=setTimeout(()=>dismiss(item.id),5000);return()=>clearTimeout(timeout);},[dismiss,item.id,item.tone,item.persistent,paused]);
 return <div className="bud-toast" data-tone={item.tone} role={item.tone==='danger'?'alert':'status'}
 onMouseEnter={()=>setPaused(true)} onMouseLeave={()=>setPaused(false)}
 onFocus={()=>setPaused(true)} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node))setPaused(false);}}>
 {item.tone==='danger'?<AlertCircle aria-hidden="true"/>:item.tone==='success'?<CheckCircle2 aria-hidden="true"/>:<Info aria-hidden="true"/>}
 <span>{item.text}</span><button type="button" aria-label="إغلاق التنبيه" onClick={()=>dismiss(item.id)}><X aria-hidden="true"/></button></div>;
}
export function BudToastProvider({children}:{children:ReactNode}){
 const [items,setItems]=useState<Toast[]>([]),[target,setTarget]=useState<Element|null>(null);
 const dismiss=useCallback((id:string)=>setItems(previous=>previous.filter(v=>v.id!==id)),[]);
 const notify=useCallback(Object.assign((text:string,tone:Tone='info',options?:{id?:string;persistent?:boolean})=>{
  const id=options?.id??'toast-'+(++sequence);setItems(previous=>[...previous.filter(v=>v.id!==id).slice(-2),{id,text,tone,persistent:options?.persistent}]);return id;
 },{dismiss}),[dismiss]);
 useEffect(()=>{const update=()=>setTarget(Array.from(document.querySelectorAll('dialog[open]')).at(-1)??null);const observer=new MutationObserver(update);observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['open']});update();return()=>observer.disconnect();},[]);
 const viewport=<div className="bud-toast-viewport" dir="rtl" aria-label="تنبيهات بُعد">{items.map(item=><ToastItem key={item.id} item={item} dismiss={dismiss}/>)}</div>;
 return <context.Provider value={notify}>{children}{target?createPortal(viewport,target):viewport}</context.Provider>;
}
export function useBudToast(){const notify=useContext(context);if(!notify)throw Error('Missing BudToastProvider');return notify;}
export function BudBadge({children,tone='neutral',variant='soft'}:{children:ReactNode;tone?:Tone;variant?:'soft'|'outline'}){return <span className="bud-badge" data-tone={tone} data-variant={variant}>{children}</span>;}
export function BudStatus({children,tone='neutral'}:{children:ReactNode;tone?:Tone}){return <span className="bud-status" data-tone={tone}><i aria-hidden="true"/>{children}</span>;}
export function BudSteps({steps,current,label='مراحل الفعالية'}:{steps:string[];current:number;label?:string}){return <ol className="bud-steps" aria-label={label}>{steps.map((step,i)=><li key={step} data-state={i<current?'done':i===current?'current':'upcoming'} aria-current={i===current?'step':undefined}><bdi className="bud-step-dot" aria-hidden="true">{i<current?'✓':i+1}</bdi><span>{step}</span></li>)}</ol>;}
export function BudSkeleton({label='جارٍ تحميل المحتوى…',lines=2}:{label?:string;lines?:number}){return <div role="status" aria-label={label} className="bud-skeleton"><span className="bud-sr-only">{label}</span>{Array.from({length:Math.max(1,Math.min(4,lines))},(_,i)=><i key={i} aria-hidden="true"/>)}</div>;}
export function BudMagnetic({children}:{children:ReactNode}){
 const [xy,setXY]=useState([0,0]);
 const move=(event:PointerEvent<HTMLSpanElement>)=>{if(event.pointerType!=='mouse'||!matchMedia('(pointer:fine) and (prefers-reduced-motion:no-preference)').matches)return;const r=event.currentTarget.getBoundingClientRect();setXY([((event.clientX-r.left)/r.width-.5)*8,((event.clientY-r.top)/r.height-.5)*8]);};
 return <span className="bud-magnetic" onPointerMove={move} onPointerLeave={()=>setXY([0,0])} style={{transform:'translate3d('+xy[0]+'px,'+xy[1]+'px,0)'}}>{children}</span>;
}
export function BudFlipGrid({items,className=''}:{items:{id:string;content:ReactNode}[];className?:string}){
 const root=useRef<HTMLDivElement>(null),previous=useRef(new Map<string,DOMRect>());
 const keys=items.map(item=>item.id).join('|');
 useLayoutEffect(()=>{const next=new Map<string,DOMRect>();for(const el of root.current?.querySelectorAll<HTMLElement>('[data-flip-id]')??[]){
  const id=el.dataset.flipId??'',box=el.getBoundingClientRect(),old=previous.current.get(id);next.set(id,box);
  if(old&&!matchMedia('(prefers-reduced-motion:reduce)').matches){const dx=old.left-box.left,dy=old.top-box.top;if(Math.abs(dx)>1||Math.abs(dy)>1)el.animate([{transform:'translate('+dx+'px,'+dy+'px)'},{transform:'translate(0,0)'}],{duration:240,easing:'cubic-bezier(.2,.8,.2,1)'});}
 }previous.current=next;},[keys]);
 return <div className={'bud-flip-grid '+className} ref={root}>{items.map(item=><div className="bud-flip-item" data-flip-id={item.id} key={item.id}>{item.content}</div>)}</div>;
}
export type PartnerLogo={id:string;name:string;logoUrl:string;websiteUrl:string};
export function BudLogoCarousel({logos}:{logos:PartnerLogo[]}){
 if(!logos.length)return null;
 const many=logos.length>1;
 return <div className="bud-logo-carousel" aria-label="شركاء بُعد" data-testid="partners-carousel"><div className="bud-logo-track" data-animated={many}>
 {[...logos,...(many?logos:[])].map((p,i)=>{const logo=<img src={p.logoUrl} alt={i>=logos.length?'':p.name} loading="lazy" referrerPolicy="no-referrer" />;
 return <div className="bud-logo-item" key={p.id+'-'+i} aria-hidden={i>=logos.length?true:undefined}>{p.websiteUrl&&i<logos.length?<a href={p.websiteUrl} target="_blank" rel="noopener noreferrer" aria-label={'زيارة '+p.name}>{logo}</a>:logo}</div>;})}
 </div></div>;
}
export function BudTooltip({label,children}:{label:string;children:ReactNode}){return <Tooltip.Provider delayDuration={170}><Tooltip.Root><Tooltip.Trigger asChild><button type="button" className="bud-ui-help-trigger" aria-label={label}><Info size={16}/></button></Tooltip.Trigger><Tooltip.Portal><Tooltip.Content className="bud-ui-tooltip" collisionPadding={12} sideOffset={8}>{children}<Tooltip.Arrow className="bud-ui-tooltip-arrow"/></Tooltip.Content></Tooltip.Portal></Tooltip.Root></Tooltip.Provider>;}
export function BudPopover({label,children}:{label:string;children:ReactNode}){
 const [open,setOpen]=useState(false),id=useId(),root=useRef<HTMLSpanElement>(null),trigger=useRef<HTMLButtonElement>(null);
 useEffect(()=>{if(!open)return;const outside=(e:globalThis.PointerEvent)=>{if(!root.current?.contains(e.target as Node))setOpen(false);};const escape=(e:KeyboardEvent)=>{if(e.key==='Escape'){setOpen(false);trigger.current?.focus();}};document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape);return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);};},[open]);
 return <span className="bud-popover-root" ref={root} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node))setOpen(false);}}><button type="button" ref={trigger} className="bud-popover-trigger" aria-expanded={open} aria-controls={id} aria-haspopup="dialog" aria-label={label} onClick={()=>setOpen(v=>!v)}><Info size={16}/></button>{open&&<span id={id} role="dialog" aria-label={label} className="bud-popover-panel">{children}</span>}</span>;
}
export function BudDialog({open,onClose,titleId,children,className=''}:{open:boolean;onClose:()=>void;titleId:string;children:ReactNode;className?:string}){
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const node=ref.current;if(!node||!open)return;const focus=document.activeElement as HTMLElement|null;if(!node.open)node.showModal();return()=>{if(node.open)node.close();focus?.focus();};},[open]);
 return <dialog ref={ref} className={'bud-dialog '+className} aria-labelledby={titleId} onCancel={e=>{e.preventDefault();onClose();}} onClick={e=>{if(e.target!==e.currentTarget)return;const r=e.currentTarget.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)onClose();}}>{children}</dialog>;
}
