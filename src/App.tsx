import { useEffect, useState } from 'react';
import Platform from './Platform';
import Game from './Game';
import type { Locale } from './i18n';

function readLocale(): Locale {
  const fromURL = new URLSearchParams(location.search).get('lang');
  try { return (fromURL ?? localStorage.getItem('bud-lang')) === 'en' ? 'en' : 'ar'; }
  catch { return fromURL === 'en' ? 'en' : 'ar'; }
}

export default function App() {
  const [locale, setLocale] = useState<Locale>(readLocale);
  const [screen, setScreen] = useState<'platform' | 'game'>(() => new URLSearchParams(location.search).get('screen') === 'game' ? 'game' : 'platform');
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.dataset.theme = 'light';
    document.title = screen === 'game' ? (locale === 'ar' ? 'بُعد · سؤال وشرط' : 'BU’D · Question & Condition') : 'BU’D · بُعد';
  }, [locale, screen]);
  if (screen === 'game') return <Game locale={locale} onExit={() => { setScreen('platform'); history.replaceState(null, '', `${location.pathname}?lang=${locale}`); }} />;
  return <Platform onPlay={nextLocale => { setLocale(nextLocale); setScreen('game'); history.replaceState(null, '', `${location.pathname}?screen=game&lang=${nextLocale}`); }} />;
}
