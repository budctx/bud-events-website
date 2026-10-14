import { useEffect, useReducer, useState } from 'react';
import { Button } from './components/Button';
import { Icon } from './components/Icon';
import type { Theme } from './components/Icon';
import { copy, samplePairs } from './i18n';
import type { Locale } from './i18n';
import { initialState, previewReducer } from './preview-state';
import type { Attempts, Duration } from './preview-state';

function readPreference(key: string) {
  try { return localStorage.getItem(key); } catch { return null; }
}
const params = new URLSearchParams(location.search);
export default function App() {
  const [locale, setLocale] = useState<Locale>(() => (params.get('lang') ?? readPreference('bud-lang')) === 'en' ? 'en' : 'ar');
  const [theme, setTheme] = useState<Theme>(() => (params.get('theme') ?? readPreference('bud-theme')) === 'dark' ? 'dark' : 'light');
  const [state, dispatch] = useReducer(previewReducer, undefined, () => initialState());
  const t = copy[locale];
  const canvasOnly = params.get('canvas') === '1';
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.dataset.theme = theme;
    document.title = `بُعد · ${t.title}`;
    try { localStorage.setItem('bud-lang', locale); localStorage.setItem('bud-theme', theme); } catch { /* Storage is optional. */ }
  }, [locale, theme, t.title]);
  useEffect(() => {
    if (state.deadline === null || state.seconds === 0 || state.outcome) return;
    const tick = () => dispatch({ type: 'tick', now: performance.now() });
    const id = window.setInterval(tick, 100);
    document.addEventListener('visibilitychange', tick);
    return () => { window.clearInterval(id); document.removeEventListener('visibilitychange', tick); };
  }, [state.deadline, state.seconds === 0, state.outcome]);
  const both = state.question && state.condition;
  const status = state.outcome ? t.stopped : !both ? t.waiting : state.seconds === 0 ? t.zero : t.running;
  const pair = samplePairs[locale][state.attempt - 1];
  return <>
    <a className="skip-link" href="#event">{t.skip}</a>
    <main className="event" id="event" tabIndex={-1} aria-labelledby="event-title">
      <h1 id="event-title">{t.title}</h1>
      <ol className="phase-rail" aria-label={locale === 'ar' ? 'مراحل الفعالية' : 'Event phases'}>
        {t.phases.map((phase, i) => <li key={i} aria-current={i === 1 ? 'step' : undefined}>
          <span className="phase-short">{phase}</span><span className="phase-long">{t.longPhases[i]}</span>
        </li>)}
      </ol>
      <section className="participant panel" aria-label={t.participant}>
        <Icon name="user" theme={theme} /><p>{t.participant}</p>
      </section>
      <div className="live-layout">
        <section className="card-pair" aria-label={t.title}>
          <div className="cards">
            {(['question', 'condition'] as const).map((kind, i) => <article className="game-card panel" key={kind} aria-labelledby={`${kind}-title`}>
              <h2 id={`${kind}-title`}>{t[kind]}</h2>
              {state[kind] ? <p className="card-content" dir="auto">{pair[i]}</p> : <Icon name={kind} theme={theme} />}
              <p className="caption">{state[kind] ? t.revealed : t.hidden}</p>
              <Button variant="primary" disabled={state[kind] || !!state.outcome} aria-label={`${t.reveal} ${t[kind]}`} onClick={() => dispatch({ type: 'reveal', card: kind, now: performance.now() })}>{t.reveal}</Button>
            </article>)}
          </div>
          <p className="caption pair-hint">{t.hint}</p>
        </section>
        <div className="host-controls">
          <section className="timer panel" aria-label={t.duration}>
            <div className="numeric-row"><Icon name="timer" theme={theme} /><span className="seconds" role="timer" aria-live="off">{state.seconds}</span></div>
            <p className="caption" role="status">{status}</p>
          </section>
          <section className="judgment panel" aria-labelledby="judgment-title">
            <h2 id="judgment-title">{t.judgment}</h2>
            <div className="judgment-buttons">
              {(locale === 'ar' ? [true, false] : [false, true]).map(correct => <Button key={String(correct)} variant={correct ? 'primary' : 'secondary'} disabled={!both || !!state.outcome} onClick={() => dispatch({ type: 'judge', correct })}>{correct ? t.correct : t.incorrect}</Button>)}
            </div>
          </section>
          <section className="session panel" aria-label={t.session}>
            <div className="numeric-row"><Icon name="timer" theme={theme} /><span>240:00</span></div><p className="caption">{t.session}</p>
          </section>
          {state.maxAttempts > 1 && <p className="attempt caption">{t.attempt} <bdi>{state.attempt} / {state.maxAttempts}</bdi></p>}
          {state.outcome && <p className="outcome panel" role="status">{t[state.outcome]}</p>}
        </div>
      </div>
      <p className="caption specimen-label">{t.demo}</p>
    </main>
    {!canvasOnly && <aside className="preview-controls panel" aria-labelledby="preview-title">
      <h2 id="preview-title">{t.controls}</h2><p>{t.note}</p>
      <div className="settings-grid">
        <div className="field"><label htmlFor="locale">{t.language}</label><select id="locale" value={locale} onChange={e => setLocale(e.target.value as Locale)}><option value="ar">العربية</option><option value="en">English</option></select></div>
        <div className="field"><label htmlFor="theme">{t.theme}</label><select id="theme" value={theme} onChange={e => setTheme(e.target.value as Theme)}><option value="light">{t.light}</option><option value="dark">{t.dark}</option></select></div>
        <div className="field"><label htmlFor="duration">{t.duration}</label><select id="duration" value={state.duration} onChange={e => dispatch({ type: 'reset', duration: Number(e.target.value) as Duration, maxAttempts: state.maxAttempts })}>{[5,7,10].map(n => <option key={n} value={n}>{n} {t.seconds}</option>)}</select></div>
        <div className="field"><label htmlFor="attempts">{t.attempts}</label><select id="attempts" value={state.maxAttempts} onChange={e => dispatch({ type: 'reset', duration: state.duration, maxAttempts: Number(e.target.value) as Attempts })}>{[1,2,3].map(n => <option key={n} value={n}>{n}</option>)}</select></div>
      </div>
      <Button onClick={() => dispatch({ type: 'reset', duration: state.duration, maxAttempts: state.maxAttempts })}>{t.reset}</Button>
    </aside>}
  </>;
}
