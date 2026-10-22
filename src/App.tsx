import { lazy, Suspense, useEffect, useState } from 'react';
import Platform from './Platform';
// Development-only host workspace. No host module is shipped in public builds.
const DevGame = import.meta.env.DEV ? lazy(() => import('./Game')) : null;
import type { Locale } from './i18n';

function readLocale(): Locale {
  const fromURL = new URLSearchParams(location.search).get('lang');
  try { return (fromURL ?? localStorage.getItem('bud-lang')) === 'en' ? 'en' : 'ar'; }
  catch { return fromURL === 'en' ? 'en' : 'ar'; }
}

export default function App() {
  const [locale] = useState<Locale>(readLocale);
  const [screen, setScreen] = useState<'platform' | 'game'>(() => import.meta.env.DEV && new URLSearchParams(location.search).get('screen') === 'game' ? 'game' : 'platform');
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.dataset.theme = 'light';
    document.title = screen === 'game' ? (locale === 'ar' ? 'بُعد · سؤال وشرط' : 'BU’D · Question & Condition') : 'BU’D · بُعد';
  }, [locale, screen]);
  if (screen === 'game' && DevGame) return <Suspense fallback={<p role="status">{locale === 'ar' ? 'جارٍ التحميل…' : 'Loading…'}</p>}><DevGame locale={locale} onExit={() => { setScreen('platform'); history.replaceState(null, '', `${location.pathname}?lang=${locale}`); }} /></Suspense>;
  return <Platform />;
}
