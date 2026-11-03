import {useEffect,useRef,useState} from 'react';
import {ArrowRight,ArrowLeft,Bomb,BookOpen,Copy,Dices,Gift,Grid3X3,RotateCcw,Settings2,Sparkles,Trash2,Trophy,X} from 'lucide-react';
import type {LucideIcon} from 'lucide-react';
import {createMiniSession,gameFinished,miniReducer,recordableWinner} from './engine.ts';
import type {MiniSession,MiniAction} from './engine.ts';
import {GAME_IDS,GAME_LABELS} from './catalog.ts';
import type {MiniGameKind} from './catalog.ts';
import {MiniGameStage} from './MiniGameStage.tsx';
import {PrizeReveal} from '../PrizeReveal';
import {formatEventResults} from '../event-summary';
import {WinnerList} from '../WinnerList';
import {parsePrizeLines} from '../prize-lines';
import './mini-games.css';

const icons:Record<MiniGameKind,LucideIcon>={bomb:Bomb,'form-word':BookOpen,scramble:RotateCcw,pattern:Grid3X3,emoji:Sparkles,wheel:Dices};
const words={bomb:'تبادل فتح المربعات بين لاعبين. من يكشف القنبلة يخسر.', 'form-word':'كوّن أطول كلمة من خمسة أحرف.',scramble:'رتب الأحرف واكشف الكلمة الصحيحة.',pattern:'تذكر تسلسل الألوان، ثم أعده بالترتيب.',emoji:'طابق أزواج الإيموجي واجمع نقاطًا أكثر.',wheel:'تصنيف عشوائي وحرف عشوائي. الأسرع في الإجابة يفوز.'};
type Props={initial:MiniSession;onChange?:(session:MiniSession)=>void;onExit?:()=>void;sessionName?:string};
const num=(v:number)=>new Intl.NumberFormat('ar-u-nu-latn').format(v);

export function MiniGames({initial,onChange,onExit,sessionName='ميني قيمز'}:Props){
 const [state,setState]=useState(initial),latest=useRef(initial);
 const [selected,setSelected]=useState<MiniGameKind|null>(null),[size,setSize]=useState<4|5|6>(5),[pairs,setPairs]=useState<3|5|7>(5),[level,setLevel]=useState<4|5|6>(5),[seconds,setSeconds]=useState(60);
 const [clock,setClock]=useState(Date.now()),[confirmExit,setConfirmExit]=useState(false),[winnerForm,setWinnerForm]=useState(false),[name,setName]=useState(''),[notice,setNotice]=useState('');
 const [pickedWinner,setPickedWinner]=useState<string|null>(null),[reveal,setReveal]=useState<{name:string;winnerId:string|null}|null>(null);
 const dialog=useRef<HTMLDialogElement>(null);
 const send=(action:MiniAction)=>{
  const next=miniReducer(latest.current,action,Date.now());
  if(next!==latest.current){latest.current=next;setState(next);onChange?.(next);}
 };
 useEffect(()=>{
  const tick=()=>{const now=Date.now();setClock(now);const active=latest.current.active;if(active?.kind==='emoji'&&active.mismatchUntil!==null&&now>=active.mismatchUntil)send({type:'resolve'});};
  const handle=window.setInterval(tick,120);
  document.addEventListener('visibilitychange',tick);
  return()=>{window.clearInterval(handle);document.removeEventListener('visibilitychange',tick);};
 },[]);
 const modalOpen=!!selected||!!state.active;
 useEffect(()=>{
  const node=dialog.current;if(!node)return;
  const previous=document.activeElement as HTMLElement|null;
  if(modalOpen){if(!node.open)node.showModal();document.body.style.overflow='hidden';}
  else{if(node.open)node.close();document.body.style.overflow='';}
  return()=>{if(node.open)node.close();document.body.style.overflow='';if(previous?.isConnected)previous.focus({preventScroll:true});};
 },[modalOpen]);
 const requestClose=()=>{
  if(winnerForm){setWinnerForm(false);return;}
  if(!selected&&!state.active)return;
  if(state.active&&!gameFinished(state.active,clock)){setConfirmExit(true);return;}
  if(state.active?.kind==='bomb'&&state.active.finished){setConfirmExit(true);return;}
  confirmClose();
 };
 const confirmClose=()=>{send({type:'close'});setSelected(null);setConfirmExit(false);setWinnerForm(false);setName('');};
 const open=(kind:MiniGameKind)=>{setSize(5);setPairs(5);setLevel(5);setSeconds(kind==='form-word'?60:30);setConfirmExit(false);setNotice('');setSelected(kind);};
 const start=()=>{if(!selected)return;send({type:'open',game:selected,size,pairs,level,seconds});setSelected(null);setClock(Date.now());};
 const capacity=state.prizes.length,filled=state.winners.length,full=filled>=capacity;
 const canRecord=recordableWinner(state,clock);
 const winnerMessage=capacity===0?'لا توجد جوائز مجهّزة':full?'تم تسجيل جميع الفائزين':'';
 const closeGame=()=>{send({type:'close'});setWinnerForm(false);setConfirmExit(false);};
 const saveWinner=()=>{
  if(!canRecord||!name.trim()||name.trim().length>80)return;
  send({type:'winner',name});setWinnerForm(false);setName('');setNotice('تم تسجيل الفائز.');setSelected(null);
 };
 const duplicate=name.trim()&&state.winners.some(w=>w.name.trim()===name.trim());
 const phase=state.phase;
 const copyResults=async()=>{try{await navigator.clipboard.writeText(formatEventResults(state,'ar')||'لم يُسجل فائزون');setNotice('تم نسخ الملخص.');}catch{setNotice('تعذر النسخ. يمكنك تحديد النص يدويًا.');}};
 const winner=state.winners.find(w=>w.id===pickedWinner);
 const canAward=winner&&!state.prizes.some(p=>p.winnerId===winner.id);
 return <main className="mini-root" dir="rtl" lang="ar">
  <header className="mini-top"><div className="mini-top-heading"><button type="button" className="mini-icon-button" aria-label="عودة إلى بُعد" onClick={onExit}><ArrowRight size={20}/></button><div><span className="mini-eyebrow">فعاليات بُعد</span><h1>{sessionName}</h1></div></div><div className="mini-top-actions"><span className="mini-winner-count"><Trophy size={17}/> الفائزون {num(filled)} / {num(capacity)}</span>{phase==='live'&&<button className="mini-cta mini-secondary" onClick={()=>send({type:'phase',phase:'prizes'})}><Gift size={17}/> الجوائز <ArrowLeft size={17}/></button>}</div></header>
  <div className="mini-steps" aria-label="مراحل الفعالية"><span className="is-past">الإعداد</span><span className={phase==='live'?'is-current':'is-past'}>شاشة الفعالية</span><span className={phase==='prizes'?'is-current':phase==='closing'?'is-past':''}>الجوائز</span><span className={phase==='closing'?'is-current':''}>الختام</span></div>
  {phase==='live'&&<section className="mini-hub"><div className="mini-intro"><span className="mini-eyebrow"><Sparkles size={16}/> اختر لعبتك</span><h2>ست تحديات. متعة بلا توقف.</h2><p>اختر لعبة، وابدأ التحدي مع مجتمعك. جميع الإجابات والنتائج يديرها المضيف.</p></div>
   {capacity===0&&<p className="mini-notice" role="status">لا توجد جوائز مجهّزة — تستطيع اللعب، لكن تسجيل الفائزين غير متاح.</p>}
   {capacity>0&&full&&<p className="mini-notice" role="status">تم تسجيل جميع الفائزين — تستطيع مواصلة اللعب دون تسجيل فائزين جدد.</p>}
   <div className="mini-hub-grid">{GAME_IDS.map(id=>{const Icon=icons[id];return <button type="button" key={id} className="mini-hub-card" onClick={()=>open(id)}><span className="mini-hub-icon"><Icon size={35} strokeWidth={1.75}/></span><strong>{GAME_LABELS[id]}</strong></button>;})}</div>
  </section>}
  {phase==='prizes'&&<section className="mini-prizes">
   <aside className="mini-prize-winners"><h2><Trophy size={19}/> قائمة الفائزين</h2><WinnerList winners={state.winners} prizes={state.prizes} locale="ar" selectedId={pickedWinner||undefined} onSelect={setPickedWinner} onDelete={w=>{if(window.confirm('هل تريد حذف الفائز وإعادة جائزته إلى البطاقات؟'))send({type:'delete-winner',winnerId:w.id});}}/>
    {capacity===0&&<p className="mini-notice">لا توجد جوائز مجهّزة.</p>}
   </aside>
   <section className="mini-prize-main"><h2><Gift size={20}/> كشف الجوائز</h2>
    {reveal?<PrizeReveal key={reveal.name+reveal.winnerId} name={reveal.name} winner={state.winners.find(w=>w.id===reveal.winnerId)||null} locale="ar" celebration={true} onClose={()=>setReveal(null)}/>:capacity===0?<div className="mini-empty">لا توجد جوائز في هذه الفعالية. يمكنك الانتقال مباشرة إلى الختام.</div>:<div className="mini-prize-grid">{state.prizes.map((p,i)=><button key={p.id} className={'mini-prize-card'+(p.revealed?' is-revealed':'')} disabled={p.revealed} onClick={()=>{const assigned=canAward?winner:null;if(assigned)send({type:'award',prizeId:p.id,winnerId:assigned.id});else if(!winner||state.winners.every(w=>state.prizes.some(z=>z.winnerId===w.id)))send({type:'open-prize',prizeId:p.id});else {setNotice('اختر فائزًا من القائمة أولًا.');return;}setReveal({name:p.name,winnerId:assigned?.id||null});}}>{p.revealed?<span>{p.name}</span>:<><Gift size={28}/><strong>الجائزة {num(i+1)}</strong></>}</button>)}</div>}
    {notice&&<p className="mini-notice" role="status">{notice}</p>}
    <div className="mini-action-row"><button className="mini-cta mini-secondary" disabled={state.prizes.some(p=>p.revealed)} onClick={()=>send({type:'phase',phase:'live'})}><ArrowRight size={17}/> العودة للألعاب</button><button className="mini-cta mini-primary" onClick={()=>send({type:'phase',phase:'closing'})}>الختام <ArrowLeft size={17}/></button></div>
   </section></section>}
  {phase==='closing'&&<section className="mini-closing"><Trophy size={46}/><h2>شكرًا لمشاركتكم!</h2><p>اكتملت الفعالية، وهذه نتائجها.</p><textarea readOnly aria-label="ملخص الفعالية" value={formatEventResults(state,'ar')||'لم يُسجل فائزون'} rows={Math.max(4,Math.min(12,state.winners.length+1))}/><button className="mini-cta mini-primary" onClick={()=>void copyResults()}><Copy size={17}/> نسخ الملخص</button>{notice&&<p role="status">{notice}</p>}{onExit&&<button className="mini-cta mini-secondary" onClick={onExit}>العودة إلى بُعد</button>}</section>}
  <dialog ref={dialog} className="mini-dialog" aria-label={selected?GAME_LABELS[selected]:state.active?GAME_LABELS[state.active.kind]:'إعداد اللعبة'} onCancel={e=>{e.preventDefault();requestClose();}}>
   <div className="mini-dialog-head"><h2>{selected?GAME_LABELS[selected]:state.active?GAME_LABELS[state.active.kind]:'اللعبة'}</h2><button type="button" className="mini-icon-button" aria-label="إغلاق اللعبة" onClick={requestClose}><X size={21}/></button></div>
   {confirmExit?<div className="mini-confirm"><h3>لم يتم تحديد فائز، هل أنت متأكد؟</h3><p>يمكنك العودة للعبة أو إنهاؤها دون تسجيل فائز.</p><div className="mini-action-row"><button className="mini-cta mini-secondary" onClick={()=>setConfirmExit(false)}>العودة</button><button className="mini-cta mini-primary" onClick={confirmClose}>إنهاء بدون فائز</button></div></div>:selected?<div className="mini-standby"><p>{words[selected]}</p>
    {selected==='bomb'&&<fieldset><legend><Settings2 size={16}/> حجم الشبكة</legend><div className="mini-chips">{([4,5,6] as const).map(v=><button type="button" aria-pressed={size===v} key={v} onClick={()=>setSize(v)}>{num(v)} × {num(v)}</button>)}</div></fieldset>}
    {selected==='emoji'&&<fieldset><legend><Settings2 size={16}/> عدد الأزواج</legend><div className="mini-chips">{([3,5,7] as const).map(v=><button type="button" aria-pressed={pairs===v} key={v} onClick={()=>setPairs(v)}>{num(v)} أزواج</button>)}</div></fieldset>}
    {selected==='pattern'&&<fieldset><legend><Settings2 size={16}/> طول النمط الأول</legend><div className="mini-chips">{([4,5,6] as const).map(v=><button type="button" aria-pressed={level===v} key={v} onClick={()=>setLevel(v)}>{num(v)} ألوان</button>)}</div></fieldset>}
    {(selected==='form-word'||selected==='scramble')&&<fieldset><legend><Settings2 size={16}/> مدة التحدي</legend><label className="mini-range">{num(seconds)} ثانية <input type="range" min="10" max="180" step="5" value={seconds} onChange={e=>setSeconds(Number(e.target.value))}/></label></fieldset>}
    <button type="button" className="mini-cta mini-primary mini-start" onClick={start}>بدء {GAME_LABELS[selected]} <ArrowLeft size={18}/></button>
   </div>:state.active?<div className="mini-playing">
    {winnerForm?<form className="mini-winner-form" onSubmit={e=>{e.preventDefault();saveWinner();}}><label htmlFor="mini-winner-name">اسم الفائز</label><input id="mini-winner-name" autoFocus value={name} maxLength={80} required onChange={e=>setName(e.target.value)} placeholder="أدخل اسم الفائز"/>{duplicate&&<p className="mini-notice">الاسم مسجل سابقًا، ويمكن تسجيله مجددًا كفائز مستقل.</p>}<div className="mini-action-row"><button className="mini-cta mini-secondary" type="button" onClick={()=>setWinnerForm(false)}>إلغاء</button><button type="submit" className="mini-cta mini-primary" disabled={!name.trim()}>حفظ الفائز</button></div></form>:<>
     <MiniGameStage game={state.active} now={clock} send={send}/>
     {gameFinished(state.active,clock)&&<div className="mini-game-result-actions">
      {winnerMessage?<p className="mini-notice">{winnerMessage}</p>:state.active.kind==='pattern'&&state.active.draw?<p className="mini-notice">لم يفز أحد</p>:<button className="mini-cta mini-primary" disabled={!canRecord} onClick={()=>setWinnerForm(true)}><Trophy size={17}/> تسجيل فائز</button>}
      <button className="mini-cta mini-secondary" onClick={closeGame}>إنهاء اللعبة دون فائز</button>
     </div>}
    </>}
   </div>:null}
  </dialog>
 </main>;
}
export function MiniGamesPreview({onExit}:{onExit:()=>void}){
 const [prizeText,setPrizeText]=useState('جائزة 1\nجائزة 2\nجائزة 3');
 const [session,setSession]=useState<MiniSession|null>(null);
 const parsed=parsePrizeLines(prizeText);
 if(session)return <MiniGames initial={session} onExit={onExit} onChange={setSession} sessionName="ميني قيمز — معاينة تجريبية"/>;
 return <main className="mini-root mini-preview-setup" dir="rtl" lang="ar"><div className="mini-preview-card"><span className="mini-eyebrow">نسخة تجربة غير مدفوعة</span><h1>ميني قيمز</h1><p>معاينة تفاعلية للألعاب الست. هذه التجربة لا تخصم مفاتيح، ولا تنشئ جلسة مدفوعة أو ترسل أسماء الفائزين إلى الخادم.</p><label htmlFor="mini-preview-prizes">الجوائز (اختياري، كل سطر جائزة)</label><textarea id="mini-preview-prizes" rows={5} value={prizeText} onChange={e=>setPrizeText(e.target.value)} placeholder="يمكن ترك الحقل فارغًا لتجربة اللعب دون جوائز"/><p className="mini-subtle">عدد الجوائز: {num(parsed.count)}</p><div className="mini-action-row"><button className="mini-cta mini-secondary" onClick={onExit}>عودة</button><button className="mini-cta mini-primary" disabled={!parsed.valid} onClick={()=>setSession(createMiniSession(prizeText))}>بدء المعاينة <ArrowLeft size={18}/></button></div></div></main>;
}
