// Free Aceternity expandable-card pattern: shared layout with an accessible native dialog.
import {useId,useRef,useState} from 'react';
import {LayoutGroup,motion,useReducedMotion} from 'motion/react';
import {Bot,X,ArrowUpLeft} from 'lucide-react';
import {BudBadge,BudDialog} from './BudUI';
import {ButtonUtility} from './ButtonUtility';
import './section-controls.css';
export default function BotCatalog(){
 const [open,setOpen]=useState(false),id=useId(),reduced=useReducedMotion(),trigger=useRef<HTMLButtonElement>(null);
 const transition={duration:reduced?0:0.25};
 const expand=()=>{trigger.current?.focus();setOpen(true);};
 return <LayoutGroup id={id}><div className="bud-bot-grid">
 <motion.article layoutId={reduced?undefined:'bot-card'} transition={transition} className="bud-bot-card" onClick={expand}>
 <div className="bud-bot-art" aria-hidden="true"><Bot size={68}/><span>بُعد</span></div>
 <div className="bud-bot-copy"><BudBadge tone="warning" variant="outline">قريبًا</BudBadge><motion.h2 layoutId={reduced?undefined:'bot-title'}>بوتات بُعد</motion.h2><p>نعمل على منتجات جديدة لمجتمعك. ستظهر هنا عند توفرها.</p>
 <button ref={trigger} type="button" aria-haspopup="dialog" aria-expanded={open} className="platform-action platform-action-secondary" onClick={expand}>تفاصيل المنتج <ArrowUpLeft size={18} aria-hidden="true"/></button></div>
 </motion.article></div>
 <BudDialog open={open} onClose={()=>{setOpen(false);trigger.current?.focus();}} titleId={id+'-title'} className="bud-bot-dialog">
 {open&&<motion.div layoutId={reduced?undefined:'bot-card'} transition={transition} className="bud-bot-expanded"><div className="bud-bot-close"><ButtonUtility label="إغلاق تفاصيل البوتات" icon={X} onPress={()=>setOpen(false)}/></div><div className="bud-bot-art" aria-hidden="true"><Bot size={68}/><span>بُعد</span></div><div className="bud-bot-copy"><BudBadge tone="warning" variant="outline">قريبًا</BudBadge><motion.h2 id={id+'-title'} layoutId={reduced?undefined:'bot-title'}>بوتات بُعد</motion.h2><p>نعمل على منتجات جديدة لمجتمعك. ستظهر هنا عند توفرها.</p><p>لم تُطرح بوتات للشراء أو الإضافة بعد. ستظهر التفاصيل المعتمدة هنا عند توفرها.</p></div></motion.div>}
 </BudDialog></LayoutGroup>;
}
