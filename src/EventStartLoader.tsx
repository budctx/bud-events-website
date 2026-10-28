// Aceternity Multi Step Loader pattern, adapted to authoritative request milestones.
import {useEffect,useRef} from 'react';
import {motion,useReducedMotion} from 'motion/react';
import {CheckCircle2,Circle,LoaderCircle} from 'lucide-react';
import './section-controls.css';
const states=['التحقق من المفتاح وبدء الطلب','تجهيز محتوى الفعالية','حفظ الفعالية في هذا المتصفح'];
export function EventStartLoader({step}:{step:number|null}){
 const dialog=useRef<HTMLDialogElement>(null),reduced=useReducedMotion();
 const open=step!==null;
 useEffect(()=>{const node=dialog.current;if(!node||!open)return;const focused=document.activeElement as HTMLElement|null;node.showModal();return()=>{node.close();if(focused?.isConnected)focused.focus();};},[open]);
 return <dialog ref={dialog} className="bud-start-loader" aria-labelledby="bud-start-title" onCancel={e=>e.preventDefault()}>
 <h2 id="bud-start-title">جارٍ تجهيز الفعالية</h2><p>نؤكد الطلب ونجهز الفعالية. لا تغلق الصفحة أثناء الانتظار.</p>
 <ol aria-label="مراحل تجهيز الفعالية" aria-busy={open}>{states.map((text,i)=><motion.li key={text} initial={false} animate={{opacity:step===null||i>step?0.5:1,y:reduced?0:-(step??0)*3}} transition={{duration:reduced?0:0.25}} data-state={step!==null&&i<step?'done':step===i?'current':'waiting'} aria-current={step===i?'step':undefined}>
 {step!==null&&i<step?<CheckCircle2 aria-hidden="true"/>:step===i?<LoaderCircle className="bud-spin" aria-hidden="true"/>:<Circle aria-hidden="true"/>}<span>{text}</span></motion.li>)}</ol>
 <p role="status" aria-live="polite">{step===null?'':states[step]}</p><small>إعادة المحاولة تتحقق من نفس الطلب؛ لا تستخدم مفتاحًا إضافيًا لنفس العملية.</small>
 </dialog>;
}
