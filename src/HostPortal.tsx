import { useEffect, useRef, useState } from 'react';
import { AnimatedSwitch, HelpTip } from './InterfaceControls';
import {ButtonUtility} from './ButtonUtility';
import {EventStartLoader} from './EventStartLoader';
import {RefreshCw,Copy,X} from 'lucide-react';
import { BudSteps,useBudToast } from './BudUI';
import { parsePrizeLines } from './prize-lines';
import {clearHostSetupDraft,readHostSetupDraft,saveHostSetupDraft} from './host-setup-draft';
import { formatEventResults } from './event-summary';
import { closeBrowserHostRun, getHostDashboard, getHostSession, HostClientError, newHostRequestKey, resumeHostEvent, signInHost, signOutHost, startHostEvent, startBrowserHostEvent } from './host-client';
import type { HostDashboard, HostEvent, HostSession, Locale, StartHostEvent } from './host-client';
import type { ManualConfig } from './manual-game';
import './host-portal.css';
export type { HostEvent } from './host-client';
const text = {
  ar: { title: 'مساحتك في بُعد', back: 'العودة إلى بُعد', loading: 'جارٍ تحميل مساحتك…', signin: 'سجّل دخولك', intro: 'ادخل إلى مساحتك لإدارة فعالياتك واستكمال جلساتك.', unavailable: 'مساحة الهوست غير متاحة حاليًا. حاول لاحقًا.', retry: 'إعادة المحاولة', failure: 'تعذر إتمام الطلب. يمكنك المحاولة مجددًا.', expired: 'انتهت جلسة الدخول. سجّل دخولك مجددًا.', logout: 'تسجيل الخروج', slots: 'مرات التشغيل المتاحة', slotHint: 'تُستخدم مرة تشغيل واحدة عند بدء فعالية جديدة. استكمال الفعالية لا يستخدم مرة إضافية.', setup: 'فعالية جديدة', eventTitle: 'اسم الفعالية', defaultTitle: 'سؤال وشرط', timer: 'تفعيل المؤقت', duration: 'مدة المؤقت بالثواني', prizes: 'الجوائز', prizeHelp: 'كل سطر غير فارغ جائزة مستقلة، وهو الحد الأقصى للفائزين. حتى 50 جائزة، و100 حرف لكل جائزة.', prizeError: 'أدخل حتى 50 جائزة، بحد أقصى 100 حرف لكل سطر.', start: 'بدء الفعالية', starting: 'جارٍ بدء الفعالية…', noSlots: 'لا توجد مرات تشغيل متاحة. الشراء غير متاح حاليًا.', noContent: 'هذه الفعالية غير متاحة للبدء حاليًا.', running: 'فعالياتك الجارية', history: 'فعالياتك السابقة', emptyActive: 'لا توجد فعالية جارية. ابدأ واحدة عندما تكون مستعدًا.', emptyHistory: 'ستظهر هنا الفعاليات التي تختتمها.', resume: 'عودة للفعالية', summary: 'عرض الملخص', winners: 'الفائزون', opened: 'الجوائز المفتوحة', close: 'إغلاق الملخص', copy: 'نسخ النتائج', copied: 'نُسخت النتائج', copyFailed: 'تعذر النسخ. حدد النتائج وانسخها.', unnamed: 'دون اسم', noPrizes: 'لا توجد جوائز مسجلة.', live: 'جارية', completed: 'مكتملة', preparing: 'إعداد', titleError: 'اكتب اسمًا للفعالية لا يتجاوز 100 حرف.', busy: 'جارٍ تنفيذ الطلب…', confirmChange: 'هناك طلب بدء لم نتأكد من نتيجته. استعد النتيجة بالمحاولة مجددًا قبل تغيير الإعدادات.', reload: 'تحديث القائمة' }

};
const completed = (event: HostEvent) => event.phase === 'completed' || event.phase === 'closing' || event.state.phase === 'closing';
export default function HostPortal({ onPlay, onExit, locale, view, onAuthLost,onBlockingChange }: { onPlay: (event: HostEvent) => void; onExit: () => void; locale: Locale; view?: 'setup' | 'history'; onAuthLost?: () => void;onBlockingChange?:(blocked:boolean)=>void }) {
  const t = text.ar;
  const toast=useBudToast();
  const [startStep,setStartStep]=useState<number|null>(null);
  const [status, setStatus] = useState<'loading' | 'signed-out' | 'ready' | 'unavailable' | 'error'>('loading');
  const [session, setSession] = useState<HostSession | null>(null);
  const [dashboard, setDashboard] = useState<HostDashboard | null>(null);
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [title, setTitle] = useState(t.defaultTitle);
  const [config, setConfig] = useState<ManualConfig>({ duration: 5, timerEnabled: false, attempts: 1 });
  const [prizeText, setPrizeText] = useState('');
  const [draftOwner,setDraftOwner] = useState<string|null>(null);
  const [draftRestored,setDraftRestored] = useState(false);
  const [summary, setSummary] = useState<HostEvent | null>(null);
  const [copyStatus, setCopyStatus] = useState('');
  const summaryDialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const pendingStart = useRef<StartHostEvent | null>(null);
  const locked = useRef(false);
  const [uncertain, setUncertain] = useState(false);
  useEffect(()=>{onBlockingChange?.(busy||uncertain);},[busy,uncertain,onBlockingChange]);
  useEffect(() => { if (view) heading.current?.focus({preventScroll:view==='setup'}); }, [view]);
  useEffect(() => {
    if (view === 'history' || !session?.id) return;
    const saved = readHostSetupDraft(session.id);
    if (saved) {
      setTitle(saved.title);
      setPrizeText(saved.prizeText);
      setConfig({...saved.config,attempts:1});
      setDraftRestored(true);
    } else setDraftRestored(false);
    setDraftOwner(session.id);
  },[session?.id,view]);
  useEffect(() => {
    if (view === 'history' || !session?.id || draftOwner !== session.id || pendingStart.current) return;
    // Only browser-local draft fields; financial keys and active game progress remain separate.
    saveHostSetupDraft(session.id,{title,config,prizeText});
  },[session?.id,view,draftOwner,title,config,prizeText]);
  useEffect(() => {
    const controller = new AbortController();
    setStatus('loading'); setError('');
    void (async () => {
      try { const user = await getHostSession(controller.signal); const data = await getHostDashboard(controller.signal); if (!controller.signal.aborted) { setSession(user); setDashboard(data); setStatus('ready'); } }
      catch (reason) { if (controller.signal.aborted) return; const issue = reason instanceof HostClientError ? reason : null; setStatus(issue?.status === 401 ? 'signed-out' : issue?.status === 503 ? 'unavailable' : 'error'); if (issue?.status === 401) onAuthLost?.(); }
    })();
    return () => controller.abort();
  }, [reload, onAuthLost]);
  useEffect(() => { if (summary) summaryDialog.current?.showModal(); else summaryDialog.current?.close(); }, [summary]);
  const reportError = (reason: unknown) => { const issue = reason instanceof HostClientError ? reason : null; setError(reason instanceof Error&&'code' in reason&&['LOCAL_STORAGE_UNAVAILABLE','LOCAL_EVENT_MISSING','LOCAL_CONTENT_INVALID'].includes(String(reason.code))?'تعذر فتح الحفظ المحلي. استخدم المتصفح الأصلي؛ لا توجد نسخة تقدم على الخادم.':issue?.status === 401 ? t.expired : issue?.status === 503 ? t.unavailable : t.failure); if (issue?.status === 401) {setStatus('signed-out'); onAuthLost?.();} };
  const perform = async (action: () => Promise<void>) => { if (locked.current) return; locked.current = true; setBusy(true); setError(''); try { await action(); } catch (reason) { reportError(reason); } finally { locked.current = false; setBusy(false); } };
  const parsed = parsePrizeLines(prizeText);
  const product = dashboard?.products.find(item => item.id === 'question-condition') ?? dashboard?.products[0];
  const contentReady = dashboard?.contentVersions.some(item => item.questionCount > 0 && item.conditionCount > 0) ?? false;
  const enoughRuns = dashboard !== null && dashboard.credits >= Math.max(1, product?.slotCost ?? 1);
  const start = () => perform(async () => {
    if (!title.trim() || title.trim().length > 100) { setError(t.titleError); return; }
    if (!parsed.valid) { setError(t.prizeError); return; }
    if (!pendingStart.current) pendingStart.current = { action: 'start', idempotencyKey: newHostRequestKey(), title: title.trim(), config: { ...config, attempts: 1 }, prizeText };
    setStartStep(0);
    try { const event = dashboard?.runtime==='browser-v1'&&session?await startBrowserHostEvent(session.id,pendingStart.current,setStartStep):await startHostEvent(pendingStart.current); pendingStart.current = null; setUncertain(false); if(session)clearHostSetupDraft(session.id); onPlay(event); }
    catch (reason) { setUncertain(true); throw reason; }finally{setStartStep(null);}
  });
  const summaryText = summary ? formatEventResults(summary.state,locale) : '';
  return <div className={`host-portal${view ? ' host-embedded' : ''}`} dir={locale === 'ar' ? 'rtl' : 'ltr'} lang={locale}>
    <EventStartLoader step={startStep}/>
    <header className="host-header"><button className="host-back" disabled={view==='setup'&&(busy||uncertain)} onClick={onExit}><img src="/assets/bud-emblem.svg" width="32" height="24" alt="" />{view ? (locale === 'ar' ? 'العودة' : 'Back') : t.back}</button>{!view && status === 'ready' && <button disabled={busy} onClick={() => void perform(async () => { try { await signOutHost(); } finally { pendingStart.current = null; setUncertain(false); setTitle(t.defaultTitle); setPrizeText(''); setConfig({ duration: 5, timerEnabled: false, attempts: 1 }); setSession(null); setDashboard(null); setStatus('signed-out'); } })}>{t.logout}</button>}</header>
    <div className="host-content"><div className="host-heading"><div><p className="host-eyebrow">BU’D</p><h1 ref={heading} tabIndex={-1}>{view === 'history' ? (locale === 'ar' ? 'السجل' : 'History') : view === 'setup' ? t.setup : t.title}</h1>{!view && session && status === 'ready' && <p>{session.displayName}</p>}</div>{status === 'ready' && <ButtonUtility label={t.reload} icon={RefreshCw} isDisabled={busy} onPress={() => setReload(value => value + 1)}/>}</div>
      {error && <p className="host-message host-error" role="alert">{error}</p>}
      {status === 'loading' ? <p className="host-message" role="status">{t.loading}</p> : status !== 'ready' ? <section className="host-panel host-access"><h2>{status === 'signed-out' ? t.signin : t.unavailable}</h2><p>{status === 'signed-out' ? t.intro : t.failure}</p>{status === 'signed-out' && <button className="host-discord" disabled={busy} onClick={() => void perform(() => signInHost({page:'events',locale}))}><img src="/assets/discord-symbol-white.svg" width="24" height="18" alt="Discord" />{t.signin}</button>}<button disabled={busy} onClick={() => setReload(value => value + 1)}>{t.retry}</button></section> : dashboard && <>
        {!view && <section className="host-balance host-panel" aria-label={t.slots}><div><h2>{t.slots}</h2><p>{t.slotHint}</p></div><strong>{dashboard.credits}</strong></section>}
        <div className={view ? 'host-single' : 'host-grid'}>{view !== 'history' && <section className="host-panel"><BudSteps steps={locale==='ar'?['الإعداد','شاشة الفعالية','الجوائز','الختام']:['Setup','Live','Prizes','Closing']} current={0}/><h2>{t.setup}</h2>{draftRestored&&<p className="host-local-policy" role="status">استُعيدت مسودة الإعداد من هذا المتصفح. لا تُحفظ المسودة على الخادم.</p>}<form onSubmit={event => { event.preventDefault(); void start(); }}>
          {uncertain && <p className="host-message" role="status">{t.confirmChange}</p>}
          <fieldset disabled={busy || uncertain}><label htmlFor="host-title">{t.eventTitle}</label><input id="host-title" value={title} maxLength={100} onChange={event => setTitle(event.target.value)} required />
            <div className="host-options"><AnimatedSwitch label={t.timer} checked={config.timerEnabled} onCheckedChange={timerEnabled => setConfig(previous => ({ ...previous, timerEnabled }))} /></div>
            {config.timerEnabled && <div className="host-duration"><label htmlFor="host-duration">{t.duration}</label><input id="host-duration" type="number" min={3} max={30} step={1} value={config.duration} onChange={event => setConfig(previous => ({ ...previous, duration: Number(event.target.value) }))} required /></div>}
            <div className="host-field-label"><label htmlFor="host-prizes">{t.prizes}</label><HelpTip label={locale === 'ar' ? 'توضيح الجوائز' : 'About prizes'}>{t.prizeHelp}</HelpTip></div><textarea id="host-prizes" rows={5} value={prizeText} onChange={event => setPrizeText(event.target.value)} aria-invalid={!parsed.valid} aria-describedby={!parsed.valid ? 'host-prize-error' : undefined} />{!parsed.valid && <p id="host-prize-error" role="alert" className="host-error">{t.prizeError}</p>}
          </fieldset>
          {!enoughRuns && <p>{t.noSlots}</p>}{(!product?.available || !contentReady) && <p>{t.noContent}</p>}
          <button type="submit" className="host-primary" disabled={busy || !parsed.valid || !enoughRuns || !product?.available || !contentReady}>{busy ? t.starting : uncertain ? t.retry : t.start}</button>
        </form></section>}
        {view !== 'setup' && <div className="host-session-lists">{[false, true].map(history => <section className="host-panel" key={String(history)}><h2>{history ? t.history : t.running}</h2>{dashboard.events.filter(event => completed(event) === history).length === 0 ? <p className="host-empty">{history ? t.emptyHistory : t.emptyActive}</p> : <ul>{dashboard.events.filter(event => completed(event) === history).map(event => <li key={event.eventId}><div><h3>{event.title}</h3><small>{history ? t.completed : event.phase === 'setup' ? t.preparing : t.live}{event.updatedAt && !Number.isNaN(Date.parse(event.updatedAt)) && <> · <time dateTime={event.updatedAt}>{new Date(event.updatedAt).toLocaleDateString(locale)}</time></>}</small></div><button disabled={busy||!!event.localMissing} onClick={() => { if (history) { setCopyStatus(''); setSummary(event); } else void perform(async () => onPlay(await resumeHostEvent(event.eventId,session?.id,dashboard.runtime==='browser-v1'))); }}>{event.localMissing?'السجل غير موجود في هذا المتصفح':history?t.summary:t.resume}</button>{event.localMissing&&!history&&<button disabled={busy} onClick={()=>{if(window.confirm('التقدم المحلي غير موجود. إغلاق سجل التشغيل لا يعيد الرصيد ولا يستعيد النتائج. هل تريد المتابعة؟'))void perform(async()=>{await closeBrowserHostRun(event.eventId);setReload(v=>v+1);});}}>إغلاق سجل التشغيل</button>}</li>)}</ul>}</section>)}</div>}</div>
      </>}
    </div>
    <dialog className="host-summary" ref={summaryDialog} onCancel={() => setSummary(null)} onClose={() => setSummary(null)} aria-labelledby="host-summary-title"><h2 id="host-summary-title">{summary?.title}</h2>{summary && <><p>{t.winners}: {summary.state.winners.length} · {t.opened}: {summary.state.prizes.filter(prize => prize.revealed).length}</p><pre tabIndex={0}>{summaryText || t.noPrizes}</pre><div className="host-summary-actions"><ButtonUtility label={t.copy} icon={Copy} onPress={() => {void navigator.clipboard?.writeText(summaryText).then(()=>{setCopyStatus('');toast(t.copied,'success');}).catch(()=>setCopyStatus(t.copyFailed));if(!navigator.clipboard)setCopyStatus(t.copyFailed);}}/><ButtonUtility label={t.close} icon={X} autoFocus onPress={() => setSummary(null)}/></div>{copyStatus && <p role="status">{copyStatus}</p>}</>}</dialog>
  </div>;
}
