import {BudNotice,BudSkeleton} from './BudUI';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import Platform from './Platform';
import { Seo } from './Seo';
import { dispatchHostAction, resumeHostEvent, HostClientError } from './host-client';
import {restoreBrowserRun,selectBrowserRun} from './browser-event';
import type {BrowserRun} from './browser-event';
import type { HostEvent } from './host-client';
import type { Locale } from './i18n';
const BrowserGame=lazy(()=>import('./BrowserGame'));
const ReviewPage=lazy(()=>import('./ReviewPage'));
const Game = lazy(() => import('./Game'));
function readLocale(): Locale {
  return 'ar';
}
export default function App() {
  const locale: Locale = readLocale();
  const [restored]=useState(()=>restoreBrowserRun(new URLSearchParams(location.search).get('event')));
  const [screen, setScreen] = useState<'platform' | 'game'>(() => {
    const requested = new URLSearchParams(location.search).get('screen');
    return restored||import.meta.env.DEV&&requested==='game'?'game':'platform';
  });
  const [missing,setMissing]=useState(()=>new URLSearchParams(location.search).get('screen')==='local'&&!restored);
  const [event, setEvent] = useState<HostEvent | null>(restored);
  const currentEvent = useRef<HostEvent | null>(restored);
  const leaveHost = () => { setScreen('platform'); setEvent(null); currentEvent.current = null; history.replaceState(null, '', '/events'); };
  const leaveHome = () => { setScreen('platform'); setEvent(null); currentEvent.current = null; history.replaceState(null, '', '/'); };
  useEffect(() => { document.documentElement.lang = locale; document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr'; document.documentElement.dataset.theme = 'light'; }, [locale]);
  const fallback = <BudSkeleton label="جارٍ التحميل…"/>;
  if(location.pathname==='/review')return <Suspense fallback={fallback}><ReviewPage/></Suspense>;
  if(missing)return <main className="host-portal" dir="rtl"><section className="host-panel host-access"><BudNotice tone="danger" persistent>الحفظ المحلي غير موجود. استخدم المتصفح الذي بدأت فيه الفعالية. حذف بيانات الموقع أو تغيير الجهاز يفقدك التقدم؛ لا توجد نسخة على الخادم.</BudNotice><h1>تعذر فتح الفعالية</h1><button onClick={()=>{setMissing(false);leaveHost();}}>العودة إلى بُعد</button></section></main>;
  if(screen==='game'&&event?.storage==='browser-v1'&&'content' in event)return <Suspense fallback={fallback}><BrowserGame key={event.eventId} initial={event as BrowserRun} onExit={leaveHost} onHome={leaveHome}/></Suspense>;
  if (screen === 'game' && (event || import.meta.env.DEV)) return <Suspense fallback={fallback}><Seo locale={locale} screen="game" /><Game key={event?.eventId ?? 'development'} locale={locale} initialState={event?.state} cards={event?.cards} serverNow={event?.serverNow} onAction={event ? async (command, key) => {
    if (!currentEvent.current) throw new Error('No active session');
    try { const next = await dispatchHostAction(currentEvent.current, command, key); currentEvent.current = next; setEvent(next); return next; }
    catch (reason) { if (reason instanceof HostClientError && reason.status === 409) { const fresh = await resumeHostEvent(currentEvent.current.eventId); currentEvent.current = fresh; setEvent(fresh); throw new HostClientError(reason.code, 409, fresh); } throw reason; }
  } : undefined} onConflict={next => { currentEvent.current = next; setEvent(next); }} onExit={leaveHost} /></Suspense>;
  return <Platform onPlay={(next) => { currentEvent.current = next; setEvent(next);if(next.storage==='browser-v1'&&'content' in next){selectBrowserRun(next as BrowserRun);history.replaceState(null,'',`/?screen=local&event=${next.eventId}`);} setScreen('game'); }} />;
}
