import {useEffect,useRef,useState} from 'react';
import type {FormEvent} from 'react';
import {ArrowLeft,Bomb,BookOpen,ChevronDown,Dices,Grid3X3,Info,RotateCcw,Settings2,Sparkles,Trophy,X} from 'lucide-react';
import type {LucideIcon} from 'lucide-react';
import {Plus} from 'lucide-react';
import {ButtonUtility} from '../ButtonUtility';
import {WinnerList,WinnerNumber,WinnerIcon} from '../WinnerList';
import {createMiniSession,gameFinished,gameWinner,miniReducer,recordableWinner,WHEEL_LETTER_STOP_MS,WHEEL_RESULT_HOLD_MS} from './engine.ts';
import type {MiniSession,MiniAction} from './engine.ts';
import {GAME_IDS,GAME_LABELS} from './catalog.ts';
import type {MiniGameKind} from './catalog.ts';
import {MiniGameStage} from './MiniGameStage.tsx';
import {PrizeReveal} from '../PrizeReveal';
import {formatEventResults} from '../event-summary';
import {EventPrizeStage} from '../EventPrizeStage';
import {parsePrizeLines} from '../prize-lines';
import {EventClosingStage,EventFinishDialog,EventJourneyHeader} from '../EventJourney';
import '../game.css';
import './mini-games.css';

const icons:Record<MiniGameKind,LucideIcon>={bomb:Bomb,'form-word':BookOpen,scramble:RotateCcw,pattern:Grid3X3,emoji:Sparkles,wheel:Dices};
type Props={initial:MiniSession;onChange?:(session:MiniSession)=>void;onExit?:()=>void;sessionName?:string};
const num=(v:number)=>new Intl.NumberFormat('ar-u-nu-latn').format(v);
type ManagementMode='list'|'add'|'edit'|'delete';
const resultPlayer=(player:1|2)=>player===1?'اللاعب الأول':'اللاعب الثاني';

export function MiniGames({initial,onChange,onExit,sessionName='ميني قيمز'}:Props){
 const [state,setState]=useState(initial),latest=useRef(initial);
 const [selected,setSelected]=useState<MiniGameKind|null>(null),[seconds,setSeconds]=useState(60),[help,setHelp]=useState<MiniGameKind|null>(null);
 const [clock,setClock]=useState(Date.now()),[confirmExit,setConfirmExit]=useState(false),[confirmFinish,setConfirmFinish]=useState(false),[winnerForm,setWinnerForm]=useState(false),[name,setName]=useState(''),[notice,setNotice]=useState('');
 const [pickedWinner,setPickedWinner]=useState<string|null>(null),[reveal,setReveal]=useState<{name:string;winnerId:string|null}|null>(null);
 const [managerOpen,setManagerOpen]=useState(false),[managerMode,setManagerMode]=useState<ManagementMode>('list');
 const [managerWinnerId,setManagerWinnerId]=useState(''),[managerName,setManagerName]=useState(''),[managerNotice,setManagerNotice]=useState('');
 const managerDialog=useRef<HTMLDialogElement>(null),managerTrigger=useRef<HTMLElement|null>(null);
 const gameTrigger=useRef<HTMLButtonElement|null>(null);
 const dialog=useRef<HTMLDialogElement>(null),helpDialog=useRef<HTMLDialogElement>(null),prizeRevealDialog=useRef<HTMLDialogElement>(null),helpTrigger=useRef<HTMLButtonElement|null>(null);
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
 const modalOpen=!!selected||!!state.active||winnerForm;
 useEffect(()=>{
  const node=dialog.current;if(!node)return;
  const previous=gameTrigger.current;
  if(modalOpen){if(!node.open)node.showModal();document.body.style.overflow='hidden';}
  else{if(node.open)node.close();document.body.style.overflow='';}
  return()=>{if(node.open)node.close();document.body.style.overflow='';if(previous?.isConnected)previous.focus({preventScroll:true});};
 },[modalOpen]);
 useEffect(()=>{
  const node=managerDialog.current;if(!node)return;
  if(managerOpen&&!node.open){
   node.showModal();
   (node.querySelector<HTMLElement>('[data-autofocus]')??node.querySelector<HTMLElement>('.mg-dialog-close'))?.focus({preventScroll:true});
  }else if(!managerOpen&&node.open)node.close();
  return()=>{if(node.open)node.close();if(managerOpen&&managerTrigger.current?.isConnected)managerTrigger.current.focus({preventScroll:true});};
 },[managerOpen]);
 useEffect(()=>{
  const node=helpDialog.current;if(!node)return;
  if(help){if(!node.open)node.showModal();}else if(node.open)node.close();
  return()=>{if(node.open)node.close();};
 },[help]);
 useEffect(()=>{
  const node=prizeRevealDialog.current;if(!node)return;
  if(reveal){if(!node.open)node.showModal();}else if(node.open)node.close();
  return()=>{if(node.open)node.close();};
 },[reveal]);
 const closeHelp=()=>{setHelp(null);helpTrigger.current?.focus({preventScroll:true});};
 const requestClose=()=>{
  if(winnerForm){setWinnerForm(false);return;}
  if(!selected&&!state.active)return;
  if(state.active&&!gameFinished(state.active,clock)){setConfirmExit(true);return;}
  if(state.active?.kind==='bomb'&&state.active.finished){setConfirmExit(true);return;}
  confirmClose();
 };
 const confirmClose=()=>{send({type:'close'});setSelected(null);setConfirmExit(false);setWinnerForm(false);setName('');};
 const open=(kind:MiniGameKind,trigger:HTMLButtonElement)=>{gameTrigger.current=trigger;setSeconds(kind==='form-word'?60:30);setConfirmExit(false);setNotice('');setSelected(kind);};
 const start=()=>{if(!selected)return;send({type:'open',game:selected,seconds});setSelected(null);setClock(Date.now());};
 const capacity=state.prizes.length,filled=state.winners.length,full=filled>=capacity;
 const canRecord=recordableWinner(state,clock);
 // Allow the final 3D flip to complete before opening the generic result layer.
 const flipReady=state.active?.kind==='bomb'||state.active?.kind==='emoji'
  ?clock-(state.active.completedAt??0)>=900:true;
 // Keep the category and letter visible long enough to read before showing host choices.
 const wheelActionsReady=state.active?.kind==='wheel'&&state.active.startedAt!==null
  &&clock-state.active.startedAt>=WHEEL_LETTER_STOP_MS+WHEEL_RESULT_HOLD_MS;
 const winnerMessage=capacity===0?'لا توجد جوائز مجهّزة':full?'تم تسجيل جميع الفائزين':'';
 const closeGame=()=>{send({type:'close'});setWinnerForm(false);setConfirmExit(false);};
 const saveWinner=()=>{
  const clean=name.trim(),addingFromPrizes=state.phase==='prizes';
  if(!clean||clean.length>80||(addingFromPrizes?full:!canRecord))return;
  send(addingFromPrizes?{type:'add-winner',name:clean}:{type:'winner',name:clean});
  setWinnerForm(false);setName('');setNotice('تم تسجيل الفائز.');setSelected(null);
 };
 const duplicate=name.trim()&&state.winners.some(w=>w.name.trim()===name.trim());
 const phase=state.phase;
 const copyResults=async()=>{try{await navigator.clipboard.writeText(formatEventResults(state,'ar')||'لا يوجد فائزون بعد');setNotice('نُسخت النتائج');}catch{setNotice('تعذر النسخ؛ يمكنك تحديد النتائج أدناه');}};
 const winner=state.winners.find(w=>w.id===pickedWinner);
 const canAward=winner&&!state.prizes.some(p=>p.winnerId===winner.id);
 const awardedWinners=new Set(state.prizes.map(prize=>prize.winnerId));
 const hasWaitingWinner=state.winners.some(w=>!awardedWinners.has(w.id));
 const prizesStarted=state.prizes.some(prize=>prize.revealed);
 const resultText=state.active&&gameFinished(state.active,clock)?state.active.kind==='bomb'
  ?`خسر ${resultPlayer(state.active.loser!)} · فاز ${resultPlayer(gameWinner(state.active)!)}`
  :state.active.kind==='pattern'?(state.active.draw?'لم يفز أحد':`فاز ${resultPlayer(gameWinner(state.active)!)}`)
  :state.active.kind==='emoji'?`فاز ${resultPlayer(gameWinner(state.active)!)}`:'اكتملت اللعبة':null;
 const revealPrize=(prize:MiniSession['prizes'][number])=>{
  const assigned=canAward?winner:null;
  if(!assigned&&hasWaitingWinner){
   if(winner){setNotice('اختر فائزًا من القائمة أولًا.');return;}
   if(!window.confirm('هناك فائز بانتظار جائزة. كشف هذه البطاقة دون اسم سيجعلها غير متاحة للتخصيص. هل تريد المتابعة؟'))return;
  }
  if(assigned)send({type:'award',prizeId:prize.id,winnerId:assigned.id});
  else send({type:'open-prize',prizeId:prize.id});
  setNotice('');
  setReveal({name:prize.name,winnerId:assigned?.id??null});
 };
 const openManager=(mode:ManagementMode='list',winner?:MiniSession['winners'][number])=>{
  managerTrigger.current=document.activeElement as HTMLElement|null;
  setManagerMode(mode);setManagerWinnerId(winner?.id??'');setManagerName(mode==='edit'?winner?.name??'':'');
  setManagerNotice('');setManagerOpen(true);
 };
 const closeManager=()=>{setManagerOpen(false);setManagerMode('list');setManagerWinnerId('');setManagerName('');setManagerNotice('');};
 const focusManagerRecord=(id?:string)=>{
  requestAnimationFrame(()=>{
   const root=managerDialog.current;
   const target=id?root?.querySelector<HTMLElement>(`[data-winner-id="${id}"] .mg-winner-tools button`):null;
   (target??root?.querySelector<HTMLElement>('.mg-dialog-close'))?.focus({preventScroll:true});
  });
 };
 const saveManager=(event:FormEvent<HTMLFormElement>)=>{
  event.preventDefault();
  const value=managerName.trim();
  if(!value||value.length>80||phase==='closing')return;
  if(managerMode==='add'){
   if(full||state.active)return;
   const id=`winner-${state.nextWinnerNumber}`;
   send({type:'add-winner',name:value});
   setManagerNotice('أُضيف الفائز.');setManagerMode('list');setManagerName('');focusManagerRecord(id);
  }else if(managerMode==='edit'){
   if(!state.winners.some(w=>w.id===managerWinnerId))return;
   send({type:'rename-winner',winnerId:managerWinnerId,name:value});
   setManagerNotice('عُدّل اسم الفائز.');setManagerMode('list');setManagerName('');focusManagerRecord(managerWinnerId);
  }
 };
 const deleteManagerWinner=()=>{
  if(phase==='closing'||!state.winners.some(w=>w.id===managerWinnerId))return;
  send({type:'delete-winner',winnerId:managerWinnerId});
  if(pickedWinner===managerWinnerId)setPickedWinner(null);
  setManagerMode('list');setManagerWinnerId('');setManagerNotice('حُذف الفائز، وأُعيدت جائزته إلى البطاقات إن كانت مخصصة له.');
  focusManagerRecord();
 };
 const managerWinner=state.winners.find(w=>w.id===managerWinnerId);
 const managerDuplicate=managerName.trim()&&state.winners.some(w=>w.id!==managerWinnerId&&w.name.trim()===managerName.trim());
 return <main className="mini-root" dir="rtl" lang="ar">
  <EventJourneyHeader title={sessionName} phase={phase} winnerCount={filled} prizeCount={capacity} onExit={()=>onExit?.()} onPrizes={()=>send({type:'phase',phase:'prizes'})} onWinners={()=>openManager()}/>
  {phase==='live'&&<section className="mini-hub"><div className="mini-intro"><h2>اختر لعبتك</h2></div>
   {capacity===0&&<p className="mini-notice" role="status">لا توجد جوائز مجهّزة — تستطيع اللعب، لكن تسجيل الفائزين غير متاح.</p>}
   {capacity>0&&full&&<p className="mini-notice" role="status">تم تسجيل جميع الفائزين — تستطيع مواصلة اللعب دون تسجيل فائزين جدد.</p>}
   <div className="mini-hub-grid">{GAME_IDS.map(id=>{const Icon=icons[id];return <div key={id} className="mini-hub-card">
    <button type="button" className="mini-hub-main" onClick={event=>open(id,event.currentTarget)}><span className="mini-hub-icon"><Icon size={35} strokeWidth={1.75}/></span><strong>{GAME_LABELS[id]}</strong></button>
    <button type="button" className="mini-hub-info" aria-label={'شرح '+GAME_LABELS[id]} onClick={event=>{helpTrigger.current=event.currentTarget;setHelp(id);}}><Info size={19}/></button>
   </div>;})}</div>
  </section>}
  {phase==='prizes'&&<><EventPrizeStage winners={state.winners} prizes={state.prizes} selectedWinnerId={pickedWinner??''} onSelectWinner={setPickedWinner}
   onDeleteWinner={winner=>openManager('delete',winner)}
   onAddWinner={()=>openManager('add')} addDisabled={full} onOpenPrize={revealPrize}
   onBack={()=>send({type:'phase',phase:'live'})} backDisabled={prizesStarted} onFinish={()=>setConfirmFinish(true)}/>
   {notice&&<p className="mini-notice" role="status">{notice}</p>}</>}
  {phase==='closing'&&<EventClosingStage
   summary={formatEventResults(state,'ar')}
   onCopy={()=>{void copyResults();}}
   notice={notice}
   onExit={()=>onExit?.()}/>}
  <EventFinishDialog open={confirmFinish} onCancel={()=>setConfirmFinish(false)} onConfirm={()=>{send({type:'phase',phase:'closing'});setConfirmFinish(false);}}/>
  <dialog ref={managerDialog} className="mg-dialog mg-management" dir="rtl" aria-label="الفائزون" onCancel={event=>{event.preventDefault();closeManager();}}>
   <h2>الفائزون</h2>
   <ButtonUtility className="mg-dialog-close" label="إغلاق" icon={X} onPress={closeManager}/>
   <div className="mg-management-heading"><div className="mg-management-mark" aria-hidden="true"><WinnerIcon kind="trophy"/></div>
    {managerMode==='list'&&phase!=='closing'&&<ButtonUtility className="mg-add-winner" label="إضافة فائز" icon={Plus} isDisabled={full||!!state.active} onPress={()=>{setManagerMode('add');setManagerWinnerId('');setManagerName('');setManagerNotice('');}}/>}
   </div>
   {(managerMode==='add'||managerMode==='edit')&&phase!=='closing'?<form onSubmit={saveManager}>
    <label htmlFor="mini-manager-name">{managerMode==='add'?'اسم الفائز':<>تعديل اسم الفائز {managerWinner&&<WinnerNumber id={managerWinner.id}/>}</>}</label>
    <input id="mini-manager-name" key={managerMode+managerWinnerId} data-autofocus autoFocus required autoComplete="off" maxLength={80} value={managerName} onChange={event=>setManagerName(event.target.value)}/>
    {managerDuplicate&&<p className="mg-help" role="status">الاسم مسجل سابقًا، ويمكن تسجيله مجددًا كفائز مستقل.</p>}
    <div className="mg-actions"><button type="submit" className="mg-button mg-primary" disabled={!managerName.trim()||managerName.trim().length>80||managerMode==='add'&&full}>{managerMode==='add'?'إضافة فائز':'حفظ'}</button>
     <button type="button" className="mg-button" onClick={()=>setManagerMode('list')}>إلغاء</button></div>
   </form>:managerMode==='delete'&&managerWinner&&phase!=='closing'?<div>
    <p>حذف سجل الفائز <strong dir="auto">{managerWinner.name}</strong> <WinnerNumber id={managerWinner.id}/>؟</p>
    {state.prizes.some(prize=>prize.winnerId===managerWinner.id)&&<p className="mg-help">ستُعاد جائزته إلى البطاقات المتاحة للسحب.</p>}
    <div className="mg-actions"><button type="button" className="mg-button" data-autofocus autoFocus onClick={()=>setManagerMode('list')}>إلغاء</button>
     <button type="button" className="mg-button mg-primary" onClick={deleteManagerWinner}>تأكيد الحذف</button></div>
   </div>:<WinnerList winners={state.winners} prizes={state.prizes} locale="ar" readOnly={phase==='closing'}
    onEdit={winner=>{setManagerMode('edit');setManagerWinnerId(winner.id);setManagerName(winner.name);setManagerNotice('');}}
    onDelete={winner=>{setManagerMode('delete');setManagerWinnerId(winner.id);setManagerNotice('');}}/>}
   {managerNotice&&<p className="mg-help" role="status">{managerNotice}</p>}
  </dialog>
  <dialog ref={dialog} className="mini-dialog" aria-label={winnerForm&&!state.active?'تسجيل فائز':selected?GAME_LABELS[selected]:state.active?GAME_LABELS[state.active.kind]:'إعداد اللعبة'} onCancel={e=>{e.preventDefault();requestClose();}}>
   <div className="mini-dialog-head"><h2>{selected?GAME_LABELS[selected]:state.active?GAME_LABELS[state.active.kind]:'اللعبة'}</h2><button type="button" className="mini-icon-button" aria-label="إغلاق اللعبة" onClick={requestClose}><X size={21}/></button></div>
   {confirmExit?<div className="mini-confirm"><h3>لم يتم تحديد فائز، هل أنت متأكد؟</h3><p>يمكنك العودة للعبة أو إنهاؤها دون تسجيل فائز.</p><div className="mini-action-row"><button className="mini-cta mini-secondary" onClick={()=>setConfirmExit(false)}>العودة</button><button className="mini-cta mini-primary" onClick={confirmClose}>إنهاء بدون فائز</button></div></div>:selected?<div className="mini-standby">
    <button type="button" className="mini-cta mini-primary mini-start" onClick={start}>بدء اللعبة <ArrowLeft size={20}/></button>
    {(selected==='form-word'||selected==='scramble')&&<details className="mini-standby-options">
     <summary><span><Settings2 size={17}/> خيارات اللعبة</span><ChevronDown size={18} className="mini-options-chevron"/></summary>
     <div className="mini-options-content">
      
      {(selected==='form-word'||selected==='scramble')&&<fieldset><legend>مدة التحدي</legend><label className="mini-range">{num(seconds)} ثانية <input aria-label="مدة التحدي" type="range" min="10" max="180" step="5" value={seconds} onChange={e=>setSeconds(Number(e.target.value))}/></label></fieldset>}
     </div>
    </details>}
   </div>:winnerForm&&!state.active?<form className="mini-winner-form" onSubmit={e=>{e.preventDefault();saveWinner();}}><label htmlFor="mini-prize-winner-name">اسم الفائز</label><input id="mini-prize-winner-name" autoFocus value={name} maxLength={80} required onChange={e=>setName(e.target.value)} placeholder="أدخل اسم الفائز"/>{duplicate&&<p className="mini-notice">الاسم مسجل سابقًا، ويمكن تسجيله مجددًا كفائز مستقل.</p>}<div className="mini-action-row"><button className="mini-cta mini-secondary" type="button" onClick={()=>setWinnerForm(false)}>إلغاء</button><button type="submit" className="mini-cta mini-primary" disabled={!name.trim()||full}>حفظ الفائز</button></div></form>:state.active?<div className="mini-playing">
    {winnerForm?<form className="mini-winner-form" onSubmit={e=>{e.preventDefault();saveWinner();}}><label htmlFor="mini-winner-name">اسم الفائز</label><input id="mini-winner-name" autoFocus value={name} maxLength={80} required onChange={e=>setName(e.target.value)} placeholder="أدخل اسم الفائز"/>{duplicate&&<p className="mini-notice">الاسم مسجل سابقًا، ويمكن تسجيله مجددًا كفائز مستقل.</p>}<div className="mini-action-row"><button className="mini-cta mini-secondary" type="button" onClick={()=>setWinnerForm(false)}>إلغاء</button><button type="submit" className="mini-cta mini-primary" disabled={!name.trim()}>حفظ الفائز</button></div></form>:<>
     <MiniGameStage game={state.active} now={clock} send={send}/>
     {state.active.kind==='scramble'&&state.active.revealed&&<div className="mini-word-result-actions" role="region" aria-label="نتيجة الكلمة المبعثرة">
      {winnerMessage?<p className="mini-result-note">{winnerMessage}</p>:<button className="mini-cta mini-primary" disabled={!canRecord} onClick={()=>setWinnerForm(true)}><Trophy size={17}/> تسجيل فائز</button>}
      <button className="mini-cta mini-secondary" onClick={closeGame}>إنهاء اللعبة دون فائز</button>
     </div>}
     {state.active.kind==='wheel'&&wheelActionsReady&&<div className="mini-wheel-actions" role="region" aria-label="خيارات نتيجة عجلة الحروف">
      <p>يمكنك تسجيل الفائز بعد قراءة التصنيف والحرف، أو إنهاء اللعبة دون فائز.</p>
      {winnerMessage?<p className="mini-result-note">{winnerMessage}</p>:<button className="mini-cta mini-primary" disabled={!canRecord} onClick={()=>setWinnerForm(true)}><Trophy size={17}/> تسجيل فائز</button>}
      <button className="mini-cta mini-secondary" onClick={closeGame}>إنهاء اللعبة دون فائز</button>
     </div>}
    </>}
   </div>:null}
   {state.active&&state.active.kind!=='wheel'&&state.active.kind!=='scramble'&&gameFinished(state.active,clock)&&flipReady&&!winnerForm&&<div className="mini-result-layer" role="region" aria-label="نتيجة اللعبة"><div className="mini-result-card"><p className="mini-result-text" role="status">{resultText}</p>{winnerMessage?<p className="mini-result-note">{winnerMessage}</p>:state.active.kind==='pattern'&&state.active.draw?null:<button className="mini-cta mini-primary" disabled={!canRecord} onClick={()=>setWinnerForm(true)}><Trophy size={17}/> تسجيل فائز</button>}<button className="mini-cta mini-secondary" onClick={closeGame}>إنهاء اللعبة دون فائز</button></div></div>}
  </dialog>
  <dialog ref={prizeRevealDialog} className="mini-dialog mg-award-result" aria-label="نتيجة الجائزة" onCancel={event=>{event.preventDefault();setReveal(null);}}>{reveal&&<PrizeReveal key={reveal.name+reveal.winnerId} name={reveal.name} winner={state.winners.find(w=>w.id===reveal.winnerId)||null} locale="ar" celebration={true} onClose={()=>setReveal(null)}/>}</dialog>
  <dialog ref={helpDialog} className="mini-dialog mini-help-dialog" aria-label={help?'شرح '+GAME_LABELS[help]:'شرح اللعبة'} onCancel={e=>{e.preventDefault();closeHelp();}}>
   <div className="mini-dialog-head"><h2>{help?GAME_LABELS[help]:'اللعبة'}</h2><button type="button" className="mini-icon-button" aria-label="إغلاق الشرح" onClick={closeHelp}><X size={21}/></button></div>
   <div className="mini-help-empty"><Info size={32}/><p>سيُضاف شرح اللعبة هنا لاحقًا.</p></div>
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
