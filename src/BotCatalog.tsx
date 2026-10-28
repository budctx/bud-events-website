// Free Aceternity expandable-card pattern with a native accessible dialog.
import {useId,useRef,useState} from 'react';
import {LayoutGroup,motion,useReducedMotion} from 'motion/react';
import {DoorOpen,Ticket,Gift,Gamepad2,TrendingUp,Users,ShieldCheck,CreditCard,X,ArrowUpLeft} from 'lucide-react';
import {BudBadge,BudDialog} from './BudUI';
import {ButtonUtility} from './ButtonUtility';
import './section-controls.css';
const bots=[
 {id:'temporary-rooms',name:'الرومات المؤقتة',Icon:DoorOpen},
 {id:'tickets',name:'التيكت',Icon:Ticket},
 {id:'giveaway',name:'قيف اواي',Icon:Gift},
 {id:'games',name:'الالعاب',Icon:Gamepad2},
 {id:'levels',name:'اللفلات',Icon:TrendingUp},
 {id:'gatherings',name:'تجمعات',Icon:Users},
 {id:'protection',name:'الحماية',Icon:ShieldCheck},
 {id:'subscriptions',name:'اشتراكات',Icon:CreditCard}
];
type BotProduct=typeof bots[number];
export default function BotCatalog(){
 const [active,setActive]=useState<BotProduct|null>(null),id=useId(),reduced=useReducedMotion(),triggers=useRef(new Map<string,HTMLButtonElement>());
 const transition={duration:reduced?0:0.25};
 const expand=(bot:BotProduct)=>{triggers.current.get(bot.id)?.focus();setActive(bot);};
 const artwork=(bot:BotProduct)=><div className="bud-bot-art" aria-hidden="true"><bot.Icon size={68}/><span>بُعد</span></div>;
 return <LayoutGroup id={id}><div className="bud-bot-grid" aria-label="معرض بوتات بُعد">
 {bots.map(bot=><motion.article key={bot.id} layoutId={reduced?undefined:'bot-card-'+bot.id} transition={transition} className="bud-bot-card" onClick={()=>expand(bot)} data-testid={'bot-'+bot.id}>
 {artwork(bot)}<div className="bud-bot-copy"><BudBadge tone="warning" variant="outline">قريبًا</BudBadge><motion.h2 layoutId={reduced?undefined:'bot-title-'+bot.id}>{bot.name}</motion.h2><p>تفاصيل بوت {bot.name} قريبًا.</p>
 <button ref={node=>{if(node)triggers.current.set(bot.id,node);else triggers.current.delete(bot.id);}} type="button" aria-label={'تفاصيل '+bot.name} aria-haspopup="dialog" aria-expanded={active?.id===bot.id} className="platform-action platform-action-secondary" onClick={()=>expand(bot)}>تفاصيل البوت <ArrowUpLeft size={18} aria-hidden="true"/></button></div>
 </motion.article>)}
 </div>
 <BudDialog open={!!active} onClose={()=>setActive(null)} titleId={id+'-title'} className="bud-bot-dialog">
 {active&&<motion.div layoutId={reduced?undefined:'bot-card-'+active.id} transition={transition} className="bud-bot-expanded"><div className="bud-bot-close"><ButtonUtility label="إغلاق تفاصيل البوتات" icon={X} onPress={()=>setActive(null)}/></div>{artwork(active)}<div className="bud-bot-copy"><BudBadge tone="warning" variant="outline">قريبًا</BudBadge><motion.h2 id={id+'-title'} layoutId={reduced?undefined:'bot-title-'+active.id}>{active.name}</motion.h2><p>تفاصيل بوت {active.name} قريبًا.</p><p>لم يُطرح هذا البوت للشراء أو الإضافة بعد. ستظهر التفاصيل المعتمدة هنا عند توفرها.</p></div></motion.div>}
 </BudDialog></LayoutGroup>;
}
