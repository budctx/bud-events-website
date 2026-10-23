import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import Platform from './Platform';
import { Seo } from './Seo';
import { dispatchHostAction, resumeHostEvent, HostClientError } from './host-client';
import type { HostEvent } from './host-client';
import type { Locale } from './i18n';
const HostPortal = lazy(() => import('./HostPortal'));
const Game = lazy(() => import('./Game'));
function readLocale(): Locale {
  const fromURL = new URLSearchParams(location.search).get('lang');
  try { return (fromURL ?? localStorage.getItem('bud-lang')) === 'en' ? 'en' : 'ar'; }
  catch { return fromURL === 'en' ? 'en' : 'ar'; }
}
export default function App() {
  const [locale, setLocale] = useState<Locale>(readLocale);
  const [screen, setScreen] = useState<'platform' | 'game' | 'host'>(() => {
    const requested = new URLSearchParams(location.search).get('screen');
    return requested === 'host' ? 'host' : import.meta.env.DEV && requested === 'game' ? 'game' : 'platform';
  });
  const [event, setEvent] = useState<HostEvent | null>(null);
  const currentEvent = useRef<HostEvent | null>(null);
  const showHost = (nextLocale: Locale) => { setLocale(nextLocale); setScreen('host'); history.replaceState(null, '', `${location.pathname}?screen=host&lang=${nextLocale}`); };
  const leaveHost = () => { setScreen('platform'); setEvent(null); currentEvent.current = null; history.replaceState(null, '', `${location.pathname}?lang=${locale}`); };
  useEffect(() => { document.documentElement.lang = locale; document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr'; document.documentElement.dataset.theme = 'light'; }, [locale]);
  const fallback = <p role="status">{locale === 'ar' ? 'جارٍ التحميل…' : 'Loading…'}</p>;
  if (screen === 'host') return <Suspense fallback={fallback}><Seo locale={locale} screen="host" /><HostPortal locale={locale} onExit={leaveHost} onPlay={next => { currentEvent.current = next; setEvent(next); setScreen('game'); }} /></Suspense>;
  if (screen === 'game' && (event || import.meta.env.DEV)) return <Suspense fallback={fallback}><Seo locale={locale} screen="game" /><Game key={event?.eventId ?? 'development'} locale={locale} initialState={event?.state} cards={locale === 'en' ? event?.cardsEn ?? event?.cards : event?.cards} serverNow={event?.serverNow} onAction={event ? async (command, key) => {
    if (!currentEvent.current) throw new Error('No active session');
    try { const next = await dispatchHostAction(currentEvent.current, command, key); currentEvent.current = next; setEvent(next); return next; }
    catch (reason) { if (reason instanceof HostClientError && reason.status === 409) { const fresh = await resumeHostEvent(currentEvent.current.eventId); currentEvent.current = fresh; setEvent(fresh); throw new HostClientError(reason.code, 409, fresh); } throw reason; }
  } : undefined} onConflict={next => { currentEvent.current = next; setEvent(next); }} onExit={() => { if (event) { setEvent(null); currentEvent.current = null; setScreen('host'); } else leaveHost(); }} /></Suspense>;
  return <Platform onHost={showHost} />;
}
