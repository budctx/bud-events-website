import {BudNotice} from './BudUI';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { manualGameReducer, initialManualState, validDuration, winnerNameError } from './manual-game';
import type { ManualAction, ManualConfig, ManualState } from './manual-game';
import { HostClientError, newHostRequestKey } from './host-client';
import type { HostEvent } from './host-client';
import { parsePrizeLines } from './prize-lines';
import { formatEventResults } from './event-summary';
import type { Locale } from './i18n';
import { approveNewCycle, drawNext, initialDrawState } from './draw-engine';
import type { PairId } from './draw-engine';
import {EventCountdown} from './EventCountdown';
import {ButtonUtility} from './ButtonUtility';
import {useBudToast} from './BudUI';
import {CloudUpload, Plus,LogOut,X} from 'lucide-react';
import './game.css';
import { WinnerList, WinnerNumber, WinnerIcon } from './WinnerList';
import type { ManualWinner } from './manual-game';
import { PrizeReveal } from './PrizeReveal';
import {EventPrizeStage} from './EventPrizeStage';
import { GameCard } from './GameCard';
import { AnimatedSwitch, HelpTip, InterfaceIcon } from './InterfaceControls';
import {EventClosingStage,EventFinishDialog,EventJourneyHeader,EventJourneySteps} from './EventJourney';

const words = {
  ar: { title: 'سؤال وشرط', setup: 'لوحة تحكم المقدم', timer: 'إعدادات الوقت', duration: 'مدة المؤقت', enabled: 'تفعيل المؤقت', prizes: 'الجوائز المتاحة', prizeHint: 'أدخل الجوائز', start: 'بدء الفعالية', exit: 'العودة إلى بُعد', correct: 'صحيحة', wrong: 'خاطئة', question: 'سؤال', condition: 'شرط', reveal: 'اكشف', waiting: 'انقر على البطاقات لكشفها…', answer: 'في انتظار الإجابة…', expired: 'انتهى الوقت · بانتظار حكم المقدم', winners: 'الفائزون', winnerTitle: 'تسجيل الفائز', winnerName: 'اسم الفائز', save: 'إضافة فائز', cancel: 'إلغاء', close: 'إغلاق', nameLong: 'الحد الأقصى 80 حرفًا', empty: 'لا يوجد فائزون بعد', prizePage: 'الجوائز', prize: 'جائزة', choose: 'اختر الفائز', award: 'اكشف الجائزة', assigned: 'مُنحت إلى', back: 'عودة', finish: 'انهاء', finishTitle: 'إنهاء الفعالية؟', finishNote: 'ستظهر النتائج الحالية. لا يمكن الرجوع أو تعديل الجوائز بعد الإنهاء.', confirm: 'إنهاء وعرض النتائج', thanks: 'شكرًا لكم على المشاركة', results: 'نتائج الفعالية', copy: 'نسخ النتائج', copied: 'نُسخت النتائج', copyError: 'تعذر النسخ؛ يمكنك تحديد النتائج أدناه', new: 'تجربة جديدة', practice: 'تجربة محلية · لا يُخصم أي Slot ولا تُحفظ الأسماء بعد مغادرة الصفحة', noPrizes: 'لم تُضف جوائز لهذه التجربة', full: 'اكتمل عدد الفائزين. انتقل إلى صفحة الجوائز.', error: 'اختر مدة صحيحة من 3 إلى 30 ثانية', count: 'جوائز', unawarded: 'لم تُمنح جائزة', finished: 'الختام', rangeNote: '3–30 ثانية', nameHint: 'اسم يدخله المقدم، دون تحقق من هوية Discord' }

} as const;
// Illustrative question bank only. Production content/version approval is a separate gate.
const banks = {
  ar: { questions: ['دولة', 'تطبيق جوال', 'شيء تأخذه في رحلة', 'مدينة', 'حيوان', 'أكلة'], conditions: ['تبدأ بحرف «س»', 'تحتوي على حرف «م»', 'من كلمتين', 'تبدأ بحرف «ب»', 'تحتوي على حرف «ر»', 'من أربعة أحرف أو أكثر'] }

};
const practicePairs: PairId[] = banks.ar.questions.flatMap((_, question) => banks.ar.conditions.map((_, condition): PairId => [String(question), String(condition)]));
type Props = { reviewEventId?:string; eventTitle?:string; onExit ?: () => void; locale?: Locale; initialState?: ManualState; cards?: { question: string; condition: string }; serverNow?: number; onAction?: (command: ManualAction, key: string) => Promise<HostEvent>; onConflict?: (event: HostEvent) => void; onBrowserAction?:(command:ManualAction)=>HostEvent;localSaveError?:string };
function JudgmentIcon({ correct }: { correct: boolean }) { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="9" />{correct ? <path d="m7 12 3 3 7-7" /> : <path d="m8 8 8 8m0-8-8 8" />}</svg>; }

function GameDialog({ open, title, onClose, children, className = '', initialFocus = '[data-autofocus]', feedback }: { open: boolean; title: string; onClose: () => void; children: ReactNode; className?: string; initialFocus?: string; feedback?:ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const restore = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const element = dialog.current;
    if (open && element && !element.open) { restore.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; element.showModal(); }
    else if (!open && element?.open) {
      element.close();
      const target = restore.current;
      if (target?.isConnected && !target.matches(':disabled')) target.focus();
      else document.querySelector<HTMLElement>('.event-journey-heading h1, .mg-header h1')?.focus();
    }
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const element = dialog.current;
    const target = element?.querySelector<HTMLElement>(initialFocus)
      ?? element?.querySelector<HTMLElement>('button:not(:disabled), input:not(:disabled)');
    target?.focus();
  }, [open, initialFocus]);
  return <dialog className={`mg-dialog ${className}`} ref={dialog} aria-label={title} onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === event.currentTarget) { const box = event.currentTarget.getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) onClose(); } }} onKeyDown={event => {
    if (event.key !== 'Tab') return;
    const items = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]')];
    const first = items[0], last = items.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }}><h2>{title}</h2>{children}{open&&feedback}</dialog>;
}

export default function Game({ eventTitle='سؤال وشرط',onExit, locale = 'ar', initialState, cards, serverNow, onAction, onConflict, onBrowserAction, localSaveError }: Props) {
  const toast=useBudToast();
  const announce=(action:ManualAction,before:ManualState,next:ManualState)=>{
   if(['add-winner','save-winner'].includes(action.type)&&next.winners.length>before.winners.length)toast('أُضيف الفائز.','success');
   if(action.type==='delete-winner'&&next.winners.length<before.winners.length)toast('حُذف الفائز.','success');
   if(action.type==='rename-winner'&&next.winners.some(w=>w.id===action.winnerId&&w.name!==before.winners.find(v=>v.id===w.id)?.name))toast('عُدّل اسم الفائز.','success');
  };
  const [state, setState] = useState(initialState ?? initialManualState);
  const stateRef = useRef(state);
  const [saving, setSaving] = useState(false);
  const [showSync,setShowSync]=useState(false);
  const [optimisticReveals,setOptimisticReveals]=useState<Array<'question'|'condition'>>([]);
  const queuedReveals=useRef<Array<{action:Extract<ManualAction,{type:'reveal'}>;key:string}>>([]);
  const [remoteError, setRemoteError] = useState('');
  const [retryPending, setRetryPending] = useState(false);
  const actionLock = useRef(false);
  const pendingAction = useRef<{ action: ManualAction; key: string; after?: (next: ManualState) => void } | null>(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(()=>{if(!saving){setShowSync(false);return;}const timer=window.setTimeout(()=>setShowSync(true),700);return()=>window.clearTimeout(timer);},[saving]);
  const syncReveals=()=>setOptimisticReveals([pendingAction.current,...queuedReveals.current].flatMap(item=>item?.action.type==='reveal'?[item.action.card]:[]));
  const persisted=!!onAction||!!onBrowserAction;
  const dispatch = async (action: ManualAction, after?: (next: ManualState) => void): Promise<ManualState | null> => {
    if(onBrowserAction){const next=onBrowserAction(action);setWallNow(Date.now());announce(action,stateRef.current,next.state);stateRef.current=next.state;setState(next.state);after?.(next.state);return next.state;}
    if (!onAction) { const next = manualGameReducer(stateRef.current, action); announce(action,stateRef.current,next);stateRef.current = next; setState(next); after?.(next); return next; }
    // Only the two already-loaded card faces may be previewed. Canonical state, judgments,
    // timers, round draws and prize/winner callbacks remain server-confirmed.
    if(action.type==='reveal'&&stateRef.current[action.card])return null;
    if(actionLock.current){
      if(action.type==='reveal'&&pendingAction.current?.action.type==='reveal'
        &&pendingAction.current.action.card!==action.card&&!queuedReveals.current.some(item=>item.action.card===action.card)){
        queuedReveals.current.push({action,key:newHostRequestKey()});syncReveals();
      }
      return null;
    }
    if(pendingAction.current&&pendingAction.current.action!==action)return null;
    pendingAction.current??={action,key:newHostRequestKey(),after};
    actionLock.current=true;setSaving(true);setShowSync(false);setRemoteError('');syncReveals();
    let result:ManualState|null=null;
    try{
      while(pendingAction.current){
        const pending=pendingAction.current;
        try{
          const next=await onAction(pending.action,pending.key);
          if(!mounted.current)return null;
          announce(pending.action,stateRef.current,next.state);stateRef.current=next.state;setState(next.state);result=next.state;
          pendingAction.current=queuedReveals.current.shift()??null;
          setRetryPending(false);syncReveals();pending.after?.(next.state);
        }catch(reason){
          if(!mounted.current)return null;
          if(reason instanceof HostClientError&&reason.status===409&&reason.data&&typeof reason.data==='object'&&'state' in reason.data){
            const fresh=reason.data as HostEvent;stateRef.current=fresh.state;setState(fresh.state);onConflict?.(fresh);
            pendingAction.current=null;queuedReveals.current=[];setRetryPending(false);syncReveals();
            setRemoteError(locale==='ar'?'تغيرت الفعالية في نافذة أخرى. تم تحديثها؛ راجع الحالة قبل المتابعة.':'This event changed in another window. Review the refreshed state before continuing.');
          }else{
            setRetryPending(true);
            setRemoteError(locale==='ar'?'تعذر تأكيد حفظ التغيير. أعد المحاولة لاستعادة النتيجة.':'Unable to confirm the saved change. Retry to recover the result.');
          }
          return null;
        }
      }
      return result;
    }finally{actionLock.current=false;if(mounted.current)setSaving(false);}
  };
  const [wallNow, setWallNow] = useState(Date.now);
  const clockOffset = useRef(serverNow === undefined ? 0 : serverNow - Date.now());
  useEffect(() => { if (serverNow !== undefined) clockOffset.current = serverNow - Date.now(); }, [serverNow]);
  const now = () => onBrowserAction?Date.now():onAction ? Date.now() + clockOffset.current : performance.now();
  const timerRemaining = state.deadline===null?state.config.duration:Math.max(0,(state.deadline-(persisted?wallNow+(onBrowserAction?0:clockOffset.current):performance.now()))/1000);
  const displayedRemaining = persisted && state.deadline !== null ? Math.max(0, Math.ceil((state.deadline - wallNow - (onBrowserAction?0:clockOffset.current)) / 1000)) : state.remaining;
  const [config, setConfig] = useState<ManualConfig>({ duration: 5, timerEnabled: false, attempts: 1 });
  const [prizeText, setPrizeText] = useState('');
  const [name, setName] = useState('');
  const [viewWinners, setViewWinners] = useState(false);
  const [prizeId, setPrizeId] = useState<string | null>(null);
  const [winnerId, setWinnerId] = useState('');
  const [editingWinner, setEditingWinner] = useState<ManualWinner | null>(null);
  const [deletingWinner, setDeletingWinner] = useState<ManualWinner | null>(null);
  const [editName, setEditName] = useState('');
  const [addingWinner, setAddingWinner] = useState(false);
  const [addedName, setAddedName] = useState('');
  const [managementReturnId, setManagementReturnId] = useState('');
  const [result, setResult] = useState<{ name: string; winner: ManualWinner | null } | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [notice, setNotice] = useState('');
  const [draw, setDraw] = useState(() => drawNext(practicePairs, initialDrawState()));
  const previousRound = useRef(state.round);
  const heading = useRef<HTMLHeadingElement>(null);
  const previousPhase = useRef(state.phase);
  const t = words.ar;
  const parsed = parsePrizeLines(prizeText);
  const nameError = winnerNameError(state, name);
  const both = state.question && state.condition;
  const visibleBoth=(state.question||optimisticReveals.includes('question'))&&(state.condition||optimisticReveals.includes('condition'));
  const full = state.prizes.length > 0 && state.winners.length >= state.prizes.length;
  const selectedPrize = state.prizes.find(prize => prize.id === prizeId);
  const ar = locale === 'ar';
  const selectedWinner = state.winners.find(w => w.id === winnerId && !state.prizes.some(p => p.winnerId === w.id));
  // After all recorded winners have prizes (including an empty winner list),
  // remaining sealed cards become manually revealable without a mode toggle.
  const manualOpen = !selectedWinner && state.prizes.some(p => !p.revealed)
    && state.winners.every(w => state.prizes.some(p => p.winnerId === w.id));
  const manageClose = () => { setViewWinners(false); setEditingWinner(null); setDeletingWinner(null); setAddingWinner(false); setAddedName(''); };
  const startAdding = () => { setViewWinners(true); setAddingWinner(true); setAddedName(''); setEditingWinner(null); setDeletingWinner(null); setManagementReturnId(''); };
  const summary = formatEventResults(state, locale);
  useEffect(() => {
    if (previousPhase.current !== state.phase) { previousPhase.current = state.phase; heading.current?.focus(); setNotice(''); }
  }, [state.phase]);
  useEffect(() => {
    if (previousRound.current !== state.round) { previousRound.current = state.round; if (!persisted) setDraw(previous => previous.kind === 'drawn' ? drawNext(practicePairs, previous.state) : previous); }
  }, [state.round]);
  useEffect(() => {
    if (state.deadline === null || state.pendingWinner || state.phase !== 'live') return;
    const tick = () => { if (persisted) setWallNow(Date.now()); else void dispatch({ type: 'tick', now: performance.now() }); };
    const interval = window.setInterval(tick, 100);
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', tick); };
  }, [state.deadline, state.pendingWinner, state.phase, persisted]);
  const syncBlocked=saving||retryPending;
  const closeWinner = () => { void dispatch({ type: 'cancel-winner' }, () => setName('')); };
  const copyResults = async () => { try { await navigator.clipboard.writeText(summary || t.empty); setNotice('');toast(t.copied,'success'); } catch { setNotice(t.copyError);toast(t.copyError,'danger'); } };
  const prizeDialogClose = () => setPrizeId(null);
  const practiceExhausted = !persisted && draw.kind === 'exhausted';
  const remoteExhausted = persisted && !!state.activityDraw?.exhausted;
  const exhausted = practiceExhausted || remoteExhausted;
  const renderCard = (kind: 'question' | 'condition') => <GameCard kind={kind} locale={locale} revealed={state[kind]||optimisticReveals.includes(kind)} disabled={state.pendingWinner || (saving&&!optimisticReveals.length) || retryPending || exhausted || (persisted && !cards?.[kind])} content={persisted ? (cards?.[kind] ?? '') : draw.kind === 'drawn' ? kind === 'question' ? banks.ar.questions[Number(draw.record.pair[0])] : banks.ar.conditions[Number(draw.record.pair[1])] : (ar ? 'انتهت التركيبات' : 'Pairs exhausted')} onReveal={() => void dispatch({ type: 'reveal', card: kind, now: now() })} />;
  const remoteFeedback=onAction&&remoteError?<div className="mg-sync-error">{retryPending&&<button className="mg-button mg-primary" disabled={saving} onClick={()=>{const pending=pendingAction.current;if(pending)void dispatch(pending.action);}}>{saving?'تتم المزامنة…':'إعادة المحاولة'}</button>}{!saving&&<button className="mg-button" onClick={onExit}>العودة إلى مساحتي</button>}</div>:null;
  const hasOpenDialog=state.pendingWinner||viewWinners||!!selectedPrize&&(!!selectedWinner||manualOpen)||!!result||confirmEnd;
  return <main className={`manual-game manual-phase-${state.phase}`} dir={locale === 'ar' ? 'rtl' : 'ltr'} lang={locale}>
    <fieldset className="mg-remote-controls">{state.phase === 'setup' ? <header className="mg-header"><ButtonUtility className="mg-exit" label={t.exit} icon={LogOut} isDisabled={saving} onPress={onExit}/><h1 ref={heading} tabIndex={-1}>{t.title}</h1>{showSync&&saving&&<span className="mg-sync-indicator" role="status"><CloudUpload aria-hidden="true"/>{ar?'تتم المزامنة…':'Syncing…'}</span>}</header> : <><EventJourneyHeader title={eventTitle} phase={state.phase} winnerCount={state.winners.length} prizeCount={state.prizes.length} onExit={()=>onExit?.()} onPrizes={()=>{void dispatch({type:'phase',phase:'prizes'});}} onWinners={()=>setViewWinners(true)} disabled={syncBlocked} headingRef={heading} status={showSync&&saving?<span className="mg-sync-indicator" role="status"><CloudUpload aria-hidden="true"/>{ar?'تتم المزامنة…':'Syncing…'}</span>:undefined}/><EventJourneySteps phase={state.phase}/></>}
    {!persisted && state.phase === 'setup' && <section className="mg-setup">
      <div className="mg-intro"><h2>{t.setup}</h2></div>
      <form onSubmit={event => { event.preventDefault(); if (validDuration(config.duration) && parsed.valid) dispatch({ type: 'start', config, prizeText }); }}>
        <div className="mg-setup-grid"><fieldset className="mg-panel"><legend>{t.timer}</legend>
          <div className="mg-field-label mg-timer-toggle"><AnimatedSwitch label={t.enabled} checked={config.timerEnabled} onCheckedChange={timerEnabled => setConfig({ ...config, timerEnabled, duration: validDuration(config.duration) ? config.duration : 5 })} /><HelpTip label={ar ? 'توضيح المؤقت' : 'About the timer'}>{ar ? 'المؤقت اختياري. يبدأ بعد كشف بطاقتي السؤال والشرط، ولا يحكم على الإجابة تلقائيًا.' : 'Optional: starts after both cards are revealed and never judges the answer automatically.'}</HelpTip></div>
          {config.timerEnabled && <div className="mg-timer-settings"><div className="mg-field-label"><label htmlFor="mg-duration">{t.duration}</label><HelpTip label={ar ? 'توضيح مدة المؤقت' : 'About timer duration'}>{ar ? 'اختر عدد الثواني من 3 إلى 30 ثانية، أو اكتب المدة مباشرة.' : 'Choose 3–30 seconds using the slider or enter the duration directly.'}</HelpTip></div><div className="mg-duration-row"><input id="mg-duration" type="range" aria-label={t.duration} min="3" max="30" step="1" value={Number.isFinite(config.duration) ? config.duration : 5} onChange={event => setConfig({ ...config, duration: Number(event.target.value) })} /><input type="number" aria-label={t.duration} min="3" max="30" step="1" required value={Number.isFinite(config.duration) ? config.duration : ''} onChange={event => setConfig({ ...config, duration: event.target.value === '' ? NaN : Number(event.target.value) })} /><span className="mg-help">{ar ? 'ثانية' : 'sec'}</span></div>{!validDuration(config.duration) && <BudNotice tone="danger" resolveOnUnmount>{t.error}</BudNotice>}</div>}
        </fieldset><fieldset className="mg-panel"><legend>{t.prizes} <bdi className="mg-count">{parsed.count} {t.count}</bdi></legend><div className="mg-field-label"><label htmlFor="mg-prizes">{t.prizeHint}</label><HelpTip label={ar ? 'توضيح الجوائز' : 'About prizes'}>{ar ? 'كل سطر غير فارغ يُحتسب جائزة مستقلة، وعدد الجوائز هو الحد الأقصى للفائزين. حتى 50 جائزة و100 حرف لكل جائزة. إذا تركتها فارغة يمكنك التجربة دون جوائز.' : 'Each non-empty line counts as one prize and sets the maximum winner count. Up to 50 prizes and 100 characters per prize. Leave empty to rehearse without prizes.'}</HelpTip></div><textarea id="mg-prizes" rows={5} maxLength={6000} placeholder={locale === 'ar' ? 'جائزة 1\nجائزة 2' : 'Prize 1\nPrize 2'} value={prizeText} onChange={event => setPrizeText(event.target.value)} />{!parsed.valid && <BudNotice tone="danger" resolveOnUnmount>الحد الأقصى 50 جائزة، و100 حرف لكل جائزة</BudNotice>}</fieldset></div>
        <div className="mg-panel mg-start"><button className="mg-button mg-primary" type="submit" disabled={!parsed.valid || !validDuration(config.duration)}>{t.start}</button></div>
      </form>
    </section>}
    {state.phase === 'live' && <section className="mg-live" aria-label={t.title}>
      {state.config.timerEnabled && <EventCountdown className="mg-timer" duration={state.config.duration} remaining={timerRemaining} label={t.duration} />}
      <div className="mg-cards">{renderCard('question')}{renderCard('condition')}</div>
      {exhausted && <div className="mg-panel"><BudNotice tone="warning" persistent resolveOnUnmount>استُخدمت جميع التركيبات في هذه الدورة. يمكنك بدء دورة جديدة بعد موافقتك.</BudNotice><button type="button" className="mg-button mg-primary" onClick={() => persisted ? void dispatch({ type: 'restart-cycle' }) : setDraw(previous => previous.kind === 'exhausted' ? drawNext(practicePairs, approveNewCycle(previous.state)) : previous)} disabled={saving || retryPending}>{ar ? 'انتهت الاحتمالات الممكنه نعيد من جديد؟' : 'Start a new cycle'}</button></div>}
      {full&&<BudNotice tone="warning" resolveOnUnmount>{t.full}</BudNotice>}{!exhausted&&!full&&visibleBoth&&state.config.timerEnabled&&displayedRemaining===0&&<BudNotice tone="warning" resolveOnUnmount>{t.expired}</BudNotice>}
      {!exhausted&&!full&&(!visibleBoth||!state.config.timerEnabled||displayedRemaining>0)&&<p className="mg-live-status" role="status">{!visibleBoth?t.waiting:t.answer}</p>}
      {both && !exhausted && <div className="mg-judgment mg-panel"><button className="mg-button mg-correct" disabled={syncBlocked || full || state.pendingWinner} onClick={() => dispatch({ type: 'correct' })}><JudgmentIcon correct />{t.correct}</button><button className="mg-button mg-wrong" disabled={syncBlocked || state.pendingWinner} onClick={() => dispatch({ type: 'wrong' })}><JudgmentIcon correct={false} />{t.wrong}</button></div>}
    </section>}
      {state.phase === 'prizes' && <EventPrizeStage winners={state.winners} prizes={state.prizes} selectedWinnerId={winnerId} onSelectWinner={setWinnerId}
       onDeleteWinner={winner=>{setManagementReturnId(winner.id);setDeletingWinner(winner);setViewWinners(true);}} onAddWinner={startAdding} addDisabled={syncBlocked||full} readOnly={syncBlocked}
       onOpenPrize={prize=>setPrizeId(prize.id)} onBack={()=>{void dispatch({type:'phase',phase:'live'});}} backDisabled={state.prizes.some(prize=>prize.revealed)} onFinish={()=>setConfirmEnd(true)}/>}
    {state.phase === 'closing' && <EventClosingStage summary={summary} onCopy={()=>{void copyResults();}} notice={notice} exitDisabled={!!localSaveError} onExit={()=>{if(persisted){location.assign('/review');return;}dispatch({type:'reset'});setPrizeText('');setName('');setWinnerId('');setManagementReturnId('');}}/>}
    {!persisted && <footer className="mg-disclosure">{t.practice}</footer>}
    <GameDialog feedback={remoteFeedback} open={state.pendingWinner} title={t.winnerTitle} onClose={closeWinner}><form onSubmit={event => { event.preventDefault(); if (!nameError) { void dispatch({ type: 'save-winner', name }, () => setName('')); } }}><label htmlFor="mg-winner-name">{t.winnerName}</label><input id="mg-winner-name" disabled={syncBlocked} autoFocus data-autofocus required autoComplete="off" maxLength={80} value={name} onChange={event => setName(event.target.value)} /><p className="mg-help">{t.nameHint}</p>{nameError === 'long' && <BudNotice tone="danger" resolveOnUnmount>{t.nameLong}</BudNotice>}<div className="mg-actions"><button className="mg-button mg-primary" type="submit" disabled={syncBlocked || !!nameError}>{t.save}</button><button className="mg-button" type="button" disabled={syncBlocked} onClick={closeWinner}>{t.cancel}</button></div></form></GameDialog>
    <GameDialog feedback={remoteFeedback} open={viewWinners} title={t.winners} onClose={manageClose} className="mg-management" initialFocus={addingWinner ? '#mg-add-name' : editingWinner ? '#mg-edit-name' : deletingWinner ? '[data-autofocus]' : managementReturnId ? `[data-winner-id="${managementReturnId}"] button` : '.mg-dialog-close'}>
      <ButtonUtility className="mg-dialog-close" label={t.close} icon={X} onPress={manageClose}/>
      <div className="mg-management-heading"><div className="mg-management-mark" aria-hidden="true"><WinnerIcon kind="trophy" /></div>{!addingWinner && !editingWinner && !deletingWinner && state.phase !== 'closing' && <ButtonUtility className="mg-add-winner" label={ar ? 'إضافة فائز' : 'Add a winner'} icon={Plus} isDisabled={syncBlocked || full} onPress={startAdding}/>}</div>
      {addingWinner ? <form onSubmit={event => { event.preventDefault(); if (full || winnerNameError(state, addedName)) return; const id = `winner-${state.nextWinnerNumber}`; void dispatch({ type: 'add-winner', name: addedName }, () => { setManagementReturnId(id); setAddingWinner(false); setAddedName(''); }); }}>
        <label htmlFor="mg-add-name">{t.winnerName}</label><input id="mg-add-name" disabled={syncBlocked} data-autofocus autoFocus required maxLength={80} value={addedName} onChange={event => setAddedName(event.target.value)} /><div className="mg-actions"><button type="submit" className="mg-button mg-primary" disabled={syncBlocked || full || !!winnerNameError(state, addedName)}>{t.save}</button><button type="button" className="mg-button" onClick={() => setAddingWinner(false)}>{t.cancel}</button></div>
      </form> : editingWinner ? <form onSubmit={e => { e.preventDefault(); if (!winnerNameError(state, editName)) { void dispatch({ type: 'rename-winner', winnerId: editingWinner.id, name: editName }, () => setEditingWinner(null)); } }}>
        <label htmlFor="mg-edit-name">{ar ? 'تعديل اسم الفائز' : 'Edit winner name'} <WinnerNumber id={editingWinner.id} /></label><input key={editingWinner.id} autoFocus data-autofocus id="mg-edit-name" disabled={syncBlocked} required maxLength={80} value={editName} onChange={e => setEditName(e.target.value)} /><div className="mg-actions"><button type="submit" className="mg-button mg-primary" disabled={syncBlocked || !!winnerNameError(state, editName)}>{ar ? 'حفظ' : 'Save changes'}</button><button type="button" className="mg-button" onClick={() => setEditingWinner(null)}>{t.cancel}</button></div>
      </form> : deletingWinner ? <div><p>{ar ? 'حذف سجل الفائز' : 'Delete winner record'} <strong dir="auto">{deletingWinner.name}</strong> <WinnerNumber id={deletingWinner.id} />؟</p>{state.prizes.some(p => p.winnerId === deletingWinner.id) && <p className="mg-help">{ar ? 'ستُعاد جائزته إلى البطاقات المتاحة للسحب.' : 'Their prize will return to the available draw cards.'}</p>}<div className="mg-actions"><button className="mg-button" autoFocus data-autofocus onClick={() => setDeletingWinner(null)}>{t.cancel}</button><button className="mg-button mg-primary" disabled={syncBlocked} onClick={() => { void dispatch({ type: 'delete-winner', winnerId: deletingWinner.id }, () => { if (winnerId === deletingWinner.id) setWinnerId(''); setDeletingWinner(null); }); }}>{ar ? 'تأكيد الحذف' : 'Confirm deletion'}</button></div></div> : <><WinnerList winners={state.winners} prizes={state.prizes} locale={locale} readOnly={state.phase === 'closing'||syncBlocked} onEdit={winner => { setManagementReturnId(winner.id); setEditingWinner(winner); setEditName(winner.name); }} onDelete={winner => { setManagementReturnId(winner.id); setDeletingWinner(winner); }} />{state.phase !== 'closing' && <></>}</>}
    </GameDialog>
    <GameDialog feedback={remoteFeedback} open={!!selectedPrize && (!!selectedWinner || manualOpen)} title={ar ? 'تأكيد فتح الجائزة' : 'Confirm opening prize'} onClose={prizeDialogClose} className="mg-award-confirm">
      <div className="mg-confirm-gift"><WinnerIcon kind="gift" /></div>
      <p>{manualOpen ? (ar ? 'هل تريد فتح الجائزة دون تخصيصها لفائز؟' : 'Open this prize without assigning a recipient?') : (ar ? 'هل أنت متأكد من فتح هذه الجائزة لـ' : 'Open this prize for')}</p>
      {selectedWinner && <p className="mg-confirm-winner"><strong dir="auto">{selectedWinner.name}</strong> <WinnerNumber id={selectedWinner.id} /></p>}
      <p className="mg-help">{t.prize} <bdi>{state.prizes.findIndex(p => p.id === prizeId) + 1}</bdi> · {manualOpen ? (ar ? 'ستُكشف فقط ولن ترتبط بأي اسم' : 'Revealed only; no name will be assigned') : (ar ? 'ستُربط بهذا السجل بعد التأكيد' : 'Assigned to this record after confirmation')}</p>
      <div className="mg-actions"><button className="mg-button mg-primary" disabled={syncBlocked || !selectedPrize || (!selectedWinner && !manualOpen)} onClick={() => {
        if (!selectedPrize || selectedPrize.revealed || (!selectedWinner && !manualOpen)) return;
        const action: ManualAction = manualOpen ? { type: 'open-prize', prizeId: selectedPrize.id } : { type: 'award', prizeId: selectedPrize.id, winnerId: selectedWinner!.id };
        void dispatch(action, next => { const opened = next.prizes.find(prize => prize.id === selectedPrize.id); if (!opened?.revealed) return; setResult({ name: opened.name, winner: selectedWinner ? { ...selectedWinner } : null }); setPrizeId(null); setWinnerId(''); });
      }}>{manualOpen ? (ar ? 'فتح الجائزة' : 'Reveal prize') : (ar ? 'فتح الجائزة' : 'Open their prize!')}</button><button className="mg-button" autoFocus data-autofocus onClick={prizeDialogClose}>{t.cancel}</button></div>
    </GameDialog>
    <GameDialog feedback={remoteFeedback} open={!!result} title={ar ? 'لحظة الجائزة' : 'Your prize moment'} onClose={() => setResult(null)} className="mg-award-result">
      {result && <PrizeReveal name={result.name} winner={result.winner} locale={locale} celebration={true} onClose={() => setResult(null)} />}
    </GameDialog>
    <EventFinishDialog open={confirmEnd} confirmDisabled={syncBlocked} onCancel={()=>setConfirmEnd(false)} onConfirm={()=>{void dispatch({type:'phase',phase:'closing'},()=>setConfirmEnd(false));}}/>
    </fieldset>
    <BudNotice tone="danger" persistent>{onAction?remoteError:''}</BudNotice>
    <BudNotice tone="danger" persistent>{localSaveError??''}</BudNotice>
    {remoteFeedback&&!hasOpenDialog&&<div className="mg-remote-status">{remoteFeedback}</div>}
  </main>;
}
