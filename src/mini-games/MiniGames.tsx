import {useEffect,useRef,useState} from 'react';
import type {FormEvent,ReactNode} from 'react';
import {ArrowLeft,Bomb,BookOpen,ChevronDown,Dices,Grid3X3,RotateCcw,Settings2,Sparkles,Trophy,X} from 'lucide-react';
import type {LucideIcon} from 'lucide-react';
import {Plus} from 'lucide-react';
import {ButtonUtility} from '../ButtonUtility';
import {WinnerList,WinnerNumber,WinnerIcon} from '../WinnerList';
import {createMiniSession,gameFinished,gameWinner,miniReducer,recordableWinner,WHEEL_LETTER_STOP_MS,WHEEL_RESULT_HOLD_MS} from './engine.ts';
import type {MiniSession,MiniAction} from './engine.ts';
import {GAME_IDS,GAME_LABELS} from './catalog.ts';
import type {MiniGameKind} from './catalog.ts';
import {MiniGameStage} from './MiniGameStage.tsx';
import {MINI_FLIP_RESULT_DELAY_MS} from './MiniFlipCard';
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

// Short shared-audience explanations, shown only before starting each game.
const gameInstructions:Record<MiniGameKind,ReactNode>={
 bomb:<>يتناوب لاعبان على اختيار المربعات، وفي أحدها <strong className="mini-rule-em">قنبلة مخفية</strong>. كل لاعب يحاول يتجنب القنبلة، واللي يختارها <strong className="mini-rule-loss">يخسر</strong> و<strong className="mini-rule-win">يفوز اللاعب الثاني</strong>.</>,
 'form-word':<>تظهر <strong className="mini-rule-em">5 حروف عشوائية</strong>، ويتسابق المشاركون على تكوين أطول كلمة عربية صحيحة باستخدامها قبل انتهاء الوقت. <strong className="mini-rule-win">صاحب أطول كلمة صحيحة يفوز.</strong></>,
 scramble:<>تظهر حروف كلمة <strong className="mini-rule-em">بترتيب عشوائي</strong>، ويتسابق المشاركون على معرفة الكلمة الصحيحة قبل انتهاء الوقت. <strong className="mini-rule-win">أول من يجاوب إجابة صحيحة يفوز.</strong></>,
 pattern:<>يتنافس لاعبان على حفظ <strong className="mini-rule-em">تسلسل من الألوان</strong> وإعادته بالترتيب الصحيح. إذا نجح الاثنان ينتقلان لمستوى أصعب، <strong className="mini-rule-win">واللي ينجح لحاله يفوز.</strong></>,
 emoji:<>يتناوب لاعبان على كشف بطاقتين ومحاولة العثور على <strong className="mini-rule-em">إيموجي متطابق</strong>. كل تطابق يمنح نقطة ودورًا إضافيًا، <strong className="mini-rule-win">واللي يجمع نقاطًا أكثر يفوز.</strong></>,
 wheel:<>تحدد العجلة <strong className="mini-rule-em">حرفًا وفئة عشوائيين</strong>، ويتسابق المشاركون على ذكر كلمة تبدأ بالحرف وتناسب الفئة. <strong className="mini-rule-win">أول إجابة صحيحة تفوز.</strong></>,
};

export function MiniGames({initial,onChange,onExit,sessionName='ميني قيمز'}:Props){
 const [state,setState]=useState(initial),latest=useRef(initial);
 const [selected,setSelected]=useState<MiniGameKind|null>(null),[seconds,setSeconds]=useState(60);
 const [confirmRestart,setConfirmRestart]=useState(false),[patternSymbols,setPatternSymbols]=useState(false);
 const [wordChanges,setWordChanges]=useState(0);
 const [clock,setClock]=useState(Date.now()),[confirmExit,setConfirmExit]=useState(false),[confirmFinish,setConfirmFinish]=useState(false),[winnerForm,setWinnerForm]=useState(false),[name,setName]=useState(''),[notice,setNotice]=useState('');
 const [pickedWinner,setPickedWinner]=useState<string|null>(null),[reveal,setReveal]=useState<{name:string;winnerId:string|null}|null>(null);
 const [pendingPrize,setPendingPrize]=useState<{prizeId:string;winnerId:string|null}|null>(null);
 const [managerOpen,setManagerOpen]=useState(false),[managerMode,setManagerMode]=useState<ManagementMode>('list');
 const [managerWinnerId,setManagerWinnerId]=useState(''),[managerName,setManagerName]=useState(''),[managerNotice,setManagerNotice]=useState('');
 const managerDialog=useRef<HTMLDialogElement>(null),managerTrigger=useRef<HTMLElement|null>(null);
 const gameTrigger=useRef<HTMLButtonElement|null>(null);
 const dialog=useRef<HTMLDialogElement>(null),prizeRevealDialog=useRef<HTMLDialogElement>(null),prizeConfirmDialog=useRef<HTMLDialogElement>(null);
 const cancelGame=useRef<()=>void>(()=>{});
 const prizeConfirmTrigger=useRef<HTMLElement|null>(null);
 const send=(action:MiniAction)=>{
  const at=Date.now();
  const next=miniReducer(latest.current,action,at);
  if(next!==latest.current){
   latest.current=next;setState(next);onChange?.(next);
   if(action.type==='change-word'){setClock(at);setWordChanges(count=>count+1);}
  }
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
  const node=prizeRevealDialog.current;if(!node)return;
  if(reveal){if(!node.open)node.showModal();}else if(node.open)node.close();
  return()=>{if(node.open)node.close();};
 },[reveal]);
 useEffect(()=>{
  const node=prizeConfirmDialog.current;if(!node)return;
  if(pendingPrize){
   if(!node.open)node.showModal();
   node.querySelector<HTMLElement>('[data-autofocus]')?.focus({preventScroll:true});
  }else{
   if(node.open)node.close();
   const trigger=prizeConfirmTrigger.current;
   if(trigger?.isConnected&&!trigger.matches(':disabled'))trigger.focus({preventScroll:true});
  }
  return()=>{if(node.open)node.close();};
 },[pendingPrize]);
 const requestClose=()=>{
  if(confirmRestart){setConfirmRestart(false);return;}
  if(confirmExit){setConfirmExit(false);return;}
  if(winnerForm){setWinnerForm(false);return;}
  if(!selected&&!state.active)return;
  if(state.active&&!gameFinished(state.active,clock)){setConfirmExit(true);return;}
  if(state.active?.kind==='bomb'&&state.active.finished){setConfirmExit(true);return;}
  confirmClose();
 };
 const confirmClose=()=>{send({type:'close'});setSelected(null);setConfirmExit(false);setConfirmRestart(false);setWinnerForm(false);setName('');};
 // Native cancel listeners also cover dialogs opened immediately from restored state.
 // Keep the callback current without rebinding it on every 120ms clock tick.
 cancelGame.current=requestClose;
 useEffect(()=>{
  const node=dialog.current;if(!node)return;
  const cancel=(event:Event)=>{event.preventDefault();cancelGame.current();};
  node.addEventListener('cancel',cancel);
  return()=>node.removeEventListener('cancel',cancel);
 },[]);
 const open=(kind:MiniGameKind,trigger:HTMLButtonElement)=>{gameTrigger.current=trigger;setSeconds(kind==='form-word'?60:30);setConfirmExit(false);setConfirmRestart(false);setNotice('');setSelected(kind);};
 const start=()=>{if(!selected)return;send({type:'open',game:selected,seconds});setSelected(null);setWordChanges(0);setClock(Date.now());};
 const capacity=state.prizes.length,filled=state.winners.length,full=filled>=capacity;
 const canRecord=recordableWinner(state,clock);
 const emojiDraw=state.active?.kind==='emoji'&&state.active.finished&&state.active.winner===null;
 const restart=()=>{
  const active=latest.current.active;if(!active)return;
  send({type:'open',game:active.kind,...('seconds' in active?{seconds:active.seconds}: {})});
  setConfirmRestart(false);setConfirmExit(false);setClock(Date.now());
 };
 // First show the whole flip and an additional readable hold before the result overlay.
 const flipReady=state.active?.kind==='bomb'||state.active?.kind==='emoji'
  ?clock-(state.active.completedAt??0)>=MINI_FLIP_RESULT_DELAY_MS:true;
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
 const copyResults=async()=>{try{await navigator.clipboard.writeText(formatEventResults(state,'ar',true)||'لا يوجد فائزون بعد');setNotice('نُسخت النتائج');}catch{setNotice('تعذر النسخ؛ يمكنك تحديد النتائج أدناه');}};
 const winner=state.winners.find(w=>w.id===pickedWinner);
 const canAward=winner&&!state.prizes.some(p=>p.winnerId===winner.id);
 const awardedWinners=new Set(state.prizes.map(prize=>prize.winnerId));
 const hasWaitingWinner=state.winners.some(w=>!awardedWinners.has(w.id));
 const prizesStarted=state.prizes.some(prize=>prize.revealed);
 const resultText=state.active&&gameFinished(state.active,clock)?state.active.kind==='bomb'
  ?`خسر ${resultPlayer(state.active.loser!)} · فاز ${resultPlayer(gameWinner(state.active)!)}`
  :state.active.kind==='pattern'?(state.active.draw?'لم يفز أحد':`فاز ${resultPlayer(gameWinner(state.active)!)}`)
  :state.active.kind==='emoji'?(gameWinner(state.active)?`فاز ${resultPlayer(gameWinner(state.active)!)}`:'تعادل اللاعبان'):'اكتملت اللعبة':null;
 const revealPrize=(prize:MiniSession['prizes'][number])=>{
  // Selecting a card drafts an intent; no game state changes until explicit confirmation.
  if(state.phase!=='prizes'||prize.revealed)return;
  const assigned=canAward?winner:null;
  if(!assigned&&hasWaitingWinner){setNotice('اختر فائزًا من القائمة أولًا.');return;}
  prizeConfirmTrigger.current=document.activeElement instanceof HTMLElement?document.activeElement:null;
  setPendingPrize({prizeId:prize.id,winnerId:assigned?.id??null});
  setNotice('');
 };
 const confirmPrize=()=>{
  if(!pendingPrize)return;
  const current=latest.current;
  const prize=current.prizes.find(p=>p.id===pendingPrize.prizeId);
  const recipient=pendingPrize.winnerId?current.winners.find(w=>w.id===pendingPrize.winnerId):null;
  const available=recipient&&!current.prizes.some(p=>p.winnerId===recipient.id);
  const unassignedAllowed=!recipient&&current.winners.every(w=>current.prizes.some(p=>p.winnerId===w.id));
  if(current.phase!=='prizes'||!prize||prize.revealed||(!available&&!unassignedAllowed)){
   setPendingPrize(null);setNotice('تعذر تأكيد فتح الجائزة. اختر بطاقة متاحة من جديد.');return;
  }
  const action:MiniAction=available?{type:'award',prizeId:prize.id,winnerId:recipient.id}:{type:'open-prize',prizeId:prize.id};
  send(action);
  const opened=latest.current.prizes.find(p=>p.id===prize.id);
  setPendingPrize(null);
  if(!opened?.revealed)return;
  setPickedWinner(null);
  setNotice('');
  setReveal({name:opened.name,winnerId:opened.winnerId});
 };
 const pendingPrizeRecord=pendingPrize?state.prizes.find(p=>p.id===pendingPrize.prizeId):null;
 const pendingRecipient=pendingPrize?.winnerId?state.winners.find(w=>w.id===pendingPrize.winnerId):null;
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
   </div>;})}</div>
  </section>}
  {phase==='prizes'&&<><EventPrizeStage winners={state.winners} prizes={state.prizes} selectedWinnerId={pickedWinner??''} onSelectWinner={setPickedWinner}
   onDeleteWinner={winner=>openManager('delete',winner)}
   onAddWinner={()=>openManager('add')} addDisabled={full} onOpenPrize={revealPrize}
   onBack={()=>send({type:'phase',phase:'live'})} backDisabled={prizesStarted} onFinish={()=>setConfirmFinish(true)}/>
   {notice&&<p className="mini-notice" role="status">{notice}</p>}</>}
  {phase==='closing'&&<EventClosingStage
   summary={formatEventResults(state,'ar',true)}
   onCopy={()=>{void copyResults();}}
   notice={notice}
   onExit={()=>onExit?.()}/>}
  <EventFinishDialog open={confirmFinish} onCancel={()=>setConfirmFinish(false)} onConfirm={()=>{send({type:'phase',phase:'closing'});setConfirmFinish(false);}}>
   {(hasWaitingWinner||state.prizes.some(prize=>!prize.revealed))&&<p className="mini-notice">فائزون دون جائزة: {num(state.winners.filter(w=>!awardedWinners.has(w.id)).length)} · جوائز لم تُفتح: {num(state.prizes.filter(prize=>!prize.revealed).length)}</p>}
  </EventFinishDialog>
  <dialog ref={prizeConfirmDialog} className="mg-dialog mg-award-confirm" aria-label="تأكيد فتح الجائزة" onCancel={e=>{e.preventDefault();setPendingPrize(null);}}>
   <h2>تأكيد فتح الجائزة</h2>
   <div className="mg-confirm-gift"><WinnerIcon kind="gift"/></div>
   <p>{pendingRecipient?'هل أنت متأكد من فتح هذه الجائزة لـ':'هل تريد فتح الجائزة دون تخصيصها لفائز؟'}</p>
   {pendingRecipient&&<p className="mg-confirm-winner"><strong dir="auto">{pendingRecipient.name}</strong><WinnerNumber id={pendingRecipient.id}/></p>}
   <p className="mg-help">جائزة <bdi>{state.prizes.findIndex(p=>p.id===pendingPrize?.prizeId)+1}</bdi> · {pendingRecipient?'ستُربط بهذا السجل بعد التأكيد':'ستُكشف فقط ولن ترتبط بأي اسم'}</p>
   <div className="mg-actions">
    <button type="button" className="mg-button mg-primary" disabled={!pendingPrizeRecord||pendingPrizeRecord.revealed} onClick={confirmPrize}>فتح الجائزة</button>
    <button type="button" className="mg-button" data-autofocus onClick={()=>setPendingPrize(null)}>إلغاء</button>
   </div>
  </dialog>
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
  <dialog ref={dialog} className="mini-dialog" aria-label={winnerForm&&!state.active?'تسجيل فائز':selected?GAME_LABELS[selected]:state.active?GAME_LABELS[state.active.kind]:'إعداد اللعبة'}>
   <div className="mini-dialog-head"><h2>{selected?GAME_LABELS[selected]:state.active?GAME_LABELS[state.active.kind]:'اللعبة'}</h2><button type="button" className="mini-icon-button" aria-label="إغلاق اللعبة" onClick={requestClose}><X size={21}/></button></div>
   {confirmRestart?<div className="mini-confirm"><h3>إعادة الجولة؟</h3><p>سيُلغى تقدم هذه الجولة وتبدأ جولة جديدة. الفائزون المسجلون والجوائز محفوظون.</p><div className="mini-action-row"><button className="mini-cta mini-secondary" autoFocus onClick={()=>setConfirmRestart(false)}>إلغاء</button><button className="mini-cta mini-primary" onClick={restart}>إعادة الجولة</button></div></div>:confirmExit?<div className="mini-confirm"><h3>لم يتم تحديد فائز، هل أنت متأكد؟</h3><p>يمكنك العودة للعبة أو إنهاؤها دون تسجيل فائز.</p><div className="mini-action-row"><button className="mini-cta mini-secondary" onClick={()=>setConfirmExit(false)}>العودة</button><button className="mini-cta mini-primary" onClick={confirmClose}>إنهاء بدون فائز</button></div></div>:selected?<div className="mini-standby">
    <p className="mini-standby-guide">{gameInstructions[selected]}</p>
    <button type="button" className="mini-cta mini-primary mini-start" onClick={start}>بدء اللعبة <ArrowLeft size={20}/></button>
    {selected==='pattern'&&<label className="mini-symbol-option"><input type="checkbox" checked={patternSymbols} onChange={event=>setPatternSymbols(event.target.checked)}/> تمييز الألوان بالرموز</label>}
    {(selected==='form-word'||selected==='scramble')&&<details className="mini-standby-options">
     <summary><span><Settings2 size={17}/> خيارات اللعبة</span><ChevronDown size={18} className="mini-options-chevron"/></summary>
     <div className="mini-options-content">
      
      {(selected==='form-word'||selected==='scramble')&&<fieldset><legend>مدة التحدي</legend><label className="mini-range">{num(seconds)} ثانية <input aria-label="مدة التحدي" type="range" min="10" max="180" step="5" value={seconds} onChange={e=>setSeconds(Number(e.target.value))}/></label></fieldset>}
     </div>
    </details>}
   </div>:winnerForm&&!state.active?<form className="mini-winner-form" onSubmit={e=>{e.preventDefault();saveWinner();}}><label htmlFor="mini-prize-winner-name">اسم الفائز</label><input id="mini-prize-winner-name" autoFocus value={name} maxLength={80} required onChange={e=>setName(e.target.value)} placeholder="أدخل اسم الفائز"/>{duplicate&&<p className="mini-notice">الاسم مسجل سابقًا، ويمكن تسجيله مجددًا كفائز مستقل.</p>}<div className="mini-action-row"><button className="mini-cta mini-secondary" type="button" onClick={()=>setWinnerForm(false)}>إلغاء</button><button type="submit" className="mini-cta mini-primary" disabled={!name.trim()||full}>حفظ الفائز</button></div></form>:state.active?<div className="mini-playing">
    {winnerForm?<form className="mini-winner-form" onSubmit={e=>{e.preventDefault();saveWinner();}}><label htmlFor="mini-winner-name">اسم الفائز</label><input id="mini-winner-name" autoFocus value={name} maxLength={80} required onChange={e=>setName(e.target.value)} placeholder="أدخل اسم الفائز"/>{duplicate&&<p className="mini-notice">الاسم مسجل سابقًا، ويمكن تسجيله مجددًا كفائز مستقل.</p>}<div className="mini-action-row"><button className="mini-cta mini-secondary" type="button" onClick={()=>setWinnerForm(false)}>إلغاء</button><button type="submit" className="mini-cta mini-primary" disabled={!name.trim()}>حفظ الفائز</button></div></form>:<>
     <MiniGameStage game={state.active} now={clock} send={send} patternSymbols={patternSymbols} wordChanges={wordChanges}/>
     {['bomb','emoji','pattern'].includes(state.active.kind)&&!gameFinished(state.active,clock)&&<button type="button" className="mini-icon-text mini-restart" onClick={()=>setConfirmRestart(true)}><RotateCcw size={18}/> إعادة الجولة</button>}
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
   {state.active&&state.active.kind!=='wheel'&&state.active.kind!=='scramble'&&gameFinished(state.active,clock)&&flipReady&&!winnerForm&&!confirmExit&&!confirmRestart&&<div className="mini-result-layer" role="region" aria-label="نتيجة اللعبة"><div className="mini-result-card"><p className="mini-result-text" role="status">{resultText}</p>{emojiDraw?<button className="mini-cta mini-primary" onClick={restart}>جولة فاصلة</button>:winnerMessage?<p className="mini-result-note">{winnerMessage}</p>:state.active.kind==='pattern'&&state.active.draw?null:<button className="mini-cta mini-primary" disabled={!canRecord} onClick={()=>setWinnerForm(true)}><Trophy size={17}/> تسجيل فائز</button>}<button className="mini-cta mini-secondary" onClick={closeGame}>إنهاء اللعبة دون فائز</button></div></div>}
  </dialog>
  <dialog ref={prizeRevealDialog} className="mini-dialog mg-award-result" aria-label="نتيجة الجائزة" onCancel={event=>{event.preventDefault();setReveal(null);}}>{reveal&&<PrizeReveal key={reveal.name+reveal.winnerId} name={reveal.name} winner={state.winners.find(w=>w.id===reveal.winnerId)||null} locale="ar" celebration={true} onClose={()=>setReveal(null)}/>}</dialog>
 </main>;
}
export function MiniGamesPreview({onExit}:{onExit:()=>void}){
 const [prizeText,setPrizeText]=useState('جائزة 1\nجائزة 2\nجائزة 3');
 const [session,setSession]=useState<MiniSession|null>(null);
 const parsed=parsePrizeLines(prizeText);
 if(session)return <MiniGames initial={session} onExit={onExit} onChange={setSession} sessionName="ميني قيمز — معاينة تجريبية"/>;
 return <main className="mini-root mini-preview-setup" dir="rtl" lang="ar"><div className="mini-preview-card"><span className="mini-eyebrow">نسخة تجربة غير مدفوعة</span><h1>ميني قيمز</h1><p>معاينة تفاعلية للألعاب الست. هذه التجربة لا تخصم مفاتيح، ولا تنشئ جلسة مدفوعة أو ترسل أسماء الفائزين إلى الخادم.</p><label htmlFor="mini-preview-prizes">الجوائز (اختياري، كل سطر جائزة)</label><textarea id="mini-preview-prizes" rows={5} value={prizeText} onChange={e=>setPrizeText(e.target.value)} placeholder="يمكن ترك الحقل فارغًا لتجربة اللعب دون جوائز"/><p className="mini-subtle">عدد الجوائز: {num(parsed.count)}</p><div className="mini-action-row"><button className="mini-cta mini-secondary" onClick={onExit}>عودة</button><button className="mini-cta mini-primary" disabled={!parsed.valid} onClick={()=>setSession(createMiniSession(prizeText))}>بدء المعاينة <ArrowLeft size={18}/></button></div></div></main>;
}
