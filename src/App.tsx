import {BudNotice,BudSkeleton} from './BudUI';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import Platform from './Platform';
import { Seo } from './Seo';
import { dispatchHostAction, resumeHostEvent, HostClientError } from './host-client';
import {restoreBrowserRun,selectBrowserRun} from './browser-event';
import type {BrowserRun} from './browser-event';
import {restoreMiniRun,selectMiniRun} from './mini-games/session.ts';
import type {MiniRun} from './mini-games/session.ts';
import type { HostEvent } from './host-client';
import type { Locale } from './i18n';
const BrowserGame=lazy(()=>import('./BrowserGame'));
const MiniGamesPreview=lazy(()=>import('./mini-games/MiniGames').then(mod=>({default:mod.MiniGamesPreview})));
const MiniGamesHost=lazy(()=>import('./mini-games/MiniGamesHost'));
const ReviewPage=lazy(()=>import('./ReviewPage'));
const Game = lazy(() => import('./Game'));
function isMiniRun(value:HostEvent|MiniRun):value is MiniRun{return 'kind' in value&&value.kind==='mini-games'&&'schema' in value&&value.schema===2;}
function readLocale(): Locale {
  return 'ar';
}
export default function App() {
  const locale: Locale = readLocale();
  const [restored]=useState(()=>{const eventId=new URLSearchParams(location.search).get('event');return restoreBrowserRun(eventId)??restoreMiniRun(eventId);});
  const [screen, setScreen] = useState<'platform' | 'game'>(() => {
    const requested = new URLSearchParams(location.search).get('screen');
    return restored||import.meta.env.DEV&&requested==='game'?'game':'platform';
  });
  const [missing,setMissing]=useState(()=>new URLSearchParams(location.search).get('screen')==='local'&&!restored);
  const [event, setEvent] = useState<HostEvent|MiniRun|null>(restored);
  const currentEvent = useRef<HostEvent | null>(restored&&!isMiniRun(restored)?restored:null);
  const leaveHost = () => { setScreen('platform'); setEvent(null); currentEvent.current = null; history.replaceState(null, '', '/events'); };
  const leaveHome = () => { setScreen('platform'); setEvent(null); currentEvent.current = null; history.replaceState(null, '', '/'); };
  useEffect(() => { document.documentElement.lang = locale; document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr'; document.documentElement.dataset.theme = 'light'; }, [locale]);
  const fallback = <BudSkeleton label="جارٍ التحميل…"/>;
  // Isolated preview only: never available on the canonical production domain; no credits or paid sessions are used.
  if(new URLSearchParams(location.search).get('screen')==='mini-preview'&&!['budteam.net','www.budteam.net'].includes(location.hostname))return <Suspense fallback={fallback}><MiniGamesPreview onExit={()=>location.assign('/events')}/></Suspense>;
  if(location.pathname==='/review')return <Suspense fallback={fallback}><ReviewPage/></Suspense>;
  if(missing)return <main className="host-portal" dir="rtl"><section className="host-panel host-access"><BudNotice tone="danger" persistent>الحفظ المحلي غير موجود. استخدم المتصفح الذي بدأت فيه الفعالية. حذف بيانات الموقع أو تغيير الجهاز يفقدك التقدم؛ لا توجد نسخة على الخادم.</BudNotice><h1>تعذر فتح الفعالية</h1><button onClick={()=>{setMissing(false);leaveHost();}}>العودة إلى بُعد</button></section></main>;
  if(screen==='game'&&event&&isMiniRun(event))return <Suspense fallback={fallback}><MiniGamesHost key={event.eventId} initial={event} onExit={leaveHost} onHome={leaveHome}/></Suspense>;
  const qcEvent=event&&!isMiniRun(event)?event:null;
  if(screen==='game'&&qcEvent?.storage==='browser-v1'&&'content' in qcEvent)return <Suspense fallback={fallback}><BrowserGame key={qcEvent.eventId} initial={qcEvent as BrowserRun} onExit={leaveHost} onHome={leaveHome}/></Suspense>;
  if (screen === 'game' && (qcEvent || import.meta.env.DEV)) return <Suspense fallback={fallback}><Seo locale={locale} screen="game" /><Game key={qcEvent?.eventId ?? 'development'} locale={locale} initialState={qcEvent?.state} cards={qcEvent?.cards} serverNow={qcEvent?.serverNow} onAction={qcEvent ? async (command, key) => {
    if (!currentEvent.current) throw new Error('No active session');
    try { const next = await dispatchHostAction(currentEvent.current, command, key); currentEvent.current = next; setEvent(next); return next; }
    catch (reason) { if (reason instanceof HostClientError && reason.status === 409) { const fresh = await resumeHostEvent(currentEvent.current.eventId); currentEvent.current = fresh; setEvent(fresh); throw new HostClientError(reason.code, 409, fresh); } throw reason; }
  } : undefined} onConflict={next => { currentEvent.current = next; setEvent(next); }} onExit={leaveHost} /></Suspense>;
  return <Platform onPlay={(next) => { currentEvent.current = isMiniRun(next)?null:next; setEvent(next);if(isMiniRun(next)){selectMiniRun(next);history.replaceState(null,'',`/?screen=local&event=${next.eventId}`);}else if(next.storage==='browser-v1'&&'content' in next){selectBrowserRun(next as BrowserRun);history.replaceState(null,'',`/?screen=local&event=${next.eventId}`);} setScreen('game'); }} />;
}
