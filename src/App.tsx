import { useEffect, useReducer, useRef, useState } from 'react';
import FoundationPreview from './FoundationPreview';
import { Button } from './components/Button';
import { Icon } from './components/Icon';
import type { Theme } from './components/Icon';
import { copy, samplePairs } from './i18n';
import type { Locale } from './i18n';
import { journeyCopy } from './journey-copy';
import { initialState, previewReducer } from './preview-state';
import type { Attempts, Duration } from './preview-state';
import { canRestart, capacityReached, eventReducer, initialEventState, unopenedPrizeCount } from './event-core';
import type { EventAction } from './event-core';
const params = new URLSearchParams(location.search);
function safeCopy(value: string) { return value.replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, ' ').replace(/@/g, '@\u200b'); }
function preference(key: string) { try { return localStorage.getItem(key); } catch { return null; } }
export default function App() { return params.get('screen') === 'foundation' ? <FoundationPreview /> : <Journey />; }
function Journey() {
  const [locale, setLocale] = useState<Locale>(() => (params.get('lang') ?? preference('bud-lang')) === 'en' ? 'en' : 'ar');
  const [theme, setTheme] = useState<Theme>(() => (params.get('theme') ?? preference('bud-theme')) === 'dark' ? 'dark' : 'light');
  const [event, send] = useReducer(eventReducer, undefined, initialEventState);
  const [challenge, play] = useReducer(previewReducer, undefined, () => initialState());
  const [page, setPage] = useState(0);
  const [narrow, setNarrow] = useState(() => innerWidth < 370);
  useEffect(() => { const update = () => { setNarrow(innerWidth < 370); setPage(0); }; window.addEventListener('resize', update); return () => window.removeEventListener('resize', update); }, []);
  const [wide, setWide] = useState(() => matchMedia('(min-width:1150px)').matches);
  useEffect(() => { const media = matchMedia('(min-width:1150px)'); const update = () => { setWide(media.matches); setPage(0); }; media.addEventListener('change', update); return () => media.removeEventListener('change', update); }, []);
  const [winner, setWinner] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [confirmation, setConfirmation] = useState<{ text: string; action: EventAction; after?: () => void } | null>(null);
  const [now, setNow] = useState(() => performance.now());
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const previousStage = useRef(event.stage);
  const t = copy[locale], j = journeyCopy[locale];
  const phase = event.stage.startsWith('setup') ? 0 : event.stage === 'live' ? 1 : event.stage === 'prizes' ? 2 : 3;
  const title = event.stage === 'setup-basics' ? j.basics : event.stage === 'setup-prizes' ? j.setupPrizes : event.stage === 'live' ? t.title : event.stage === 'prizes' ? j.prizes : event.stage === 'completed' ? j.completed : j.closing;
  useEffect(() => {
    document.documentElement.lang = locale; document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr'; document.documentElement.dataset.theme = theme;
    document.title = `بُعد · ${title}`;
    try { localStorage.setItem('bud-lang', locale); localStorage.setItem('bud-theme', theme); } catch { /* Optional preferences. */ }
  }, [locale, theme, title]);
  useEffect(() => { if (previousStage.current !== event.stage) { setPage(0); setWinner(null); setNotice(''); heading.current?.focus(); previousStage.current = event.stage; } }, [event.stage]);
  useEffect(() => { const id = window.setInterval(() => setNow(performance.now()), 1000); return () => clearInterval(id); }, []);
  useEffect(() => {
    if (event.stage !== 'live' || challenge.deadline === null || challenge.seconds === 0 || challenge.outcome) return;
    const tick = () => play({ type: 'tick', now: performance.now() }); const id = window.setInterval(tick, 100);
    document.addEventListener('visibilitychange', tick); return () => { clearInterval(id); document.removeEventListener('visibilitychange', tick); };
  }, [event.stage, challenge.deadline, challenge.seconds === 0, challenge.outcome]);
  useEffect(() => { if (confirmation) { dialog.current?.showModal(); } else { dialog.current?.close(); } }, [confirmation]);
  const confirm = (text: string, action: EventAction, after?: () => void) => setConfirmation({ text, action, after });
  const resetChallenge = () => play({ type: 'reset', duration: event.config.duration, maxAttempts: event.config.maxAttempts });
  const select = (action: EventAction) => {
    if (capacityReached(event)) confirm(j.capacity, { ...action, confirmNoWinner: true } as EventAction, resetChallenge);
    else { resetChallenge(); send(action); }
  };
  const judge = (correct: boolean) => {
    if (!event.activeParticipantId) return;
    const next = previewReducer(challenge, { type: 'judge', correct }); play({ type: 'judge', correct });
    if (next.outcome) send({ type: 'record-outcome', outcome: next.outcome });
  };
  const size = event.stage === 'setup-prizes' ? 3 : event.stage === 'prizes' ? (wide ? 8 : narrow ? 1 : 2) : 3;
  const prizePage = event.prizeDefinitions.slice(page * size, (page + 1) * size);
  const pages = Math.max(1, Math.ceil(event.prizeDefinitions.length / size));
  const qualifierRows = event.qualificationOrder.map(id => event.participants.find(p => p.id === id)!).filter(Boolean);
  const resultRows = event.stage === 'completed' ? qualifierRows.filter(p => event.awards.some(a => a.winnerId === p.id)) : qualifierRows;
  const resultPages = Math.max(1, resultRows.length);
  const active = event.participants.find(p => p.id === event.activeParticipantId);
  const both = challenge.question && challenge.condition;
  const pair = samplePairs[locale][challenge.attempt - 1];
  const status = challenge.outcome ? t.stopped : !both ? t.waiting : challenge.seconds === 0 ? t.zero : t.running;
  // Fixture IDs are intentionally marked unverified; production export requires server-verified Discord IDs.
  const summary = qualifierRows.flatMap(p => { const a = event.awards.find(a => a.winnerId === p.id); const prize = event.prizeDefinitions.find(x => x.id === a?.prizeId); return prize ? [`${safeCopy(p.name)} — [${j.unverified}: ${p.id}] — ${safeCopy(prize.name)}`] : []; }).join('\n');
  const copySummary = async () => { try { await navigator.clipboard.writeText(summary || j.emptyResults); setNotice(j.copied); } catch { setNotice(j.copyFailed); } };
  const pagination = (count: number) => count > 1 && <nav className="pagination" aria-label={j.page}><Button disabled={page === 0} onClick={() => setPage(p => p - 1)}>{j.previous}</Button><bdi className="caption">{page + 1} / {count}</bdi><Button disabled={page === count - 1} onClick={() => setPage(p => p + 1)}>{j.next}</Button></nav>;
  return <>
    <a className="skip-link" href="#event">{t.skip}</a>
    <main className="event journey" id="event" aria-labelledby="event-title" data-stage={event.stage}>
      <header className="journey-header"><h1 ref={heading} id="event-title" tabIndex={-1}>{title}</h1><details className="preferences"><summary>{j.preferences}</summary><div className="preferences-panel panel"><label>{t.language}<select aria-label={t.language} value={locale} onChange={e => setLocale(e.target.value as Locale)}><option value="ar">العربية</option><option value="en">English</option></select></label><label>{t.theme}<select aria-label={t.theme} value={theme} onChange={e => setTheme(e.target.value as Theme)}><option value="light">{t.light}</option><option value="dark">{t.dark}</option></select></label></div></details></header>
      <ol className="phase-rail" aria-label={locale === 'ar' ? 'مراحل الفعالية' : 'Event phases'}>{t.phases.map((name, i) => <li key={name} aria-current={i === phase ? 'step' : undefined}><span className="phase-short">{name}</span><span className="phase-long">{t.longPhases[i]}</span></li>)}</ol>
      {event.stage === 'setup-basics' && <form className="setup-body" onSubmit={e => { e.preventDefault(); send({ type: 'setup-next' }); }}>
        <div className="field event-name"><label htmlFor="event-name">{j.eventName}</label><input id="event-name" required maxLength={100} placeholder={j.namePlaceholder} value={event.config.eventName} onChange={e => send({ type: 'configure', config: { eventName: e.target.value } })} /></div>
        <div className="setup-presets">
          <fieldset className="panel preset"><legend>{t.attempts}</legend><div className="preset-options">{([1,2,3] as Attempts[]).map(n => <Button key={n} aria-pressed={event.config.maxAttempts === n} variant={event.config.maxAttempts === n ? 'primary' : 'secondary'} onClick={() => send({ type: 'configure', config: { maxAttempts: n } })}>{n}</Button>)}</div></fieldset>
          <fieldset className="panel preset"><legend>{t.duration}</legend><div className="preset-options">{([5,7,10] as Duration[]).map(n => <Button key={n} aria-pressed={event.config.duration === n} variant={event.config.duration === n ? 'primary' : 'secondary'} onClick={() => send({ type: 'configure', config: { duration: n } })}>{n}</Button>)}</div></fieldset>
          <fieldset className="panel preset"><legend>{j.prizeCount}</legend><div className="prize-counter"><Button aria-label={j.decrease} disabled={event.config.prizeCount === 0} onClick={() => send({ type: 'configure', config: { prizeCount: event.config.prizeCount - 1 } })}>−</Button><input aria-label={j.prizeCount} type="number" min={0} max={50} step={1} value={event.config.prizeCount} onChange={e => send({ type: 'configure', config: { prizeCount: Number(e.target.value) } })} /><Button aria-label={j.increase} disabled={event.config.prizeCount === 50} onClick={() => send({ type: 'configure', config: { prizeCount: event.config.prizeCount + 1 } })}>+</Button></div></fieldset>
        </div><Button type="submit" variant="primary" disabled={!event.config.eventName.trim()}>{j.setupPrizes}</Button>
      </form>}
      {event.stage === 'setup-prizes' && <section className="setup-body">
        {event.config.prizeCount === 0 ? <p className="empty-state panel">{j.empty}</p> : <><p className="caption">{j.page} <bdi>{page + 1} / {pages}</bdi> · {j.prizes} <bdi>{event.config.prizeCount}</bdi></p><div className="prize-editors">{prizePage.map((prize, i) => <div className="field panel prize-editor" key={prize.id}><label htmlFor={prize.id}>{j.prize} {page * size + i + 1}</label><textarea id={prize.id} maxLength={100} rows={2} placeholder={j.content} value={prize.name} onChange={e => send({ type: 'define-prize', prizeId: prize.id, name: e.target.value })} /></div>)}</div>{pagination(pages)}</>}
        <div className="action-row"><Button onClick={() => send({ type: 'setup-back' })}>{j.back}</Button><Button variant="primary" disabled={event.prizeDefinitions.some(p => !p.name.trim())} onClick={() => { resetChallenge(); send({ type: 'start', now: performance.now(), participants: [1,2,3].map(n => ({ id: `local-player-${n}`, name: locale === 'ar' ? `مشارك توضيحي ${n}` : `Example player ${n}` })) }); }}>{j.start}</Button></div>
      </section>}
      {event.stage === 'live' && <>
        {!active && <section className="participant-picker panel"><h2>{j.choosePlayer}</h2><p className="caption">{j.fixture}</p><div className="picker-buttons">{(['neverPlayed','previous'] as const).map(group => <section className="player-group" key={group}><h2>{group === 'neverPlayed' ? j.newPlayers : j.previousPlayers}</h2>{event.participants.filter(p => group === 'neverPlayed' ? p.status === 'neverPlayed' : p.status !== 'neverPlayed').map(p => <Button key={p.id} disabled={p.status === 'qualified'} onClick={() => select({ type: 'select-participant', mode: 'manual', id: p.id })}>{p.name} · {p.status === 'neverPlayed' ? j.newPlayers : p.status === 'qualified' ? t.qualified : t.exhausted}</Button>)}</section>)}</div><Button disabled={!event.participants.some(p => p.status === 'neverPlayed')} onClick={() => select({ type: 'select-participant', mode: 'random', random: Math.random() })}>{j.random}</Button>{!event.participants.some(p => p.status === 'neverPlayed') && <p className="caption">{j.noCandidates}</p>}</section>}
        {active && <><section className="participant panel"><Icon name="user" theme={theme} /><p>{active.name}</p></section><div className="live-layout"><section className="card-pair"><div className="cards">{(['question','condition'] as const).map((kind,i) => <article className="game-card panel" key={kind}><h2>{t[kind]}</h2>{challenge[kind] ? <p className="card-content" dir="auto">{pair[i]}</p> : <Icon name={kind} theme={theme} />}<p className="caption">{challenge[kind] ? t.revealed : t.hidden}</p><Button variant="primary" aria-label={`${t.reveal} ${t[kind]}`} disabled={challenge[kind] || !!challenge.outcome} onClick={() => play({ type: 'reveal', card: kind, now: performance.now() })}>{t.reveal}</Button></article>)}</div><p className="caption">{t.hint}</p></section><div className="host-controls"><section className="timer panel"><div className="numeric-row"><Icon name="timer" theme={theme} /><span className="seconds" role="timer">{challenge.seconds}</span></div><p className="caption" role="status">{status}</p></section><section className="judgment panel"><h2>{t.judgment}</h2><div className="judgment-buttons"><Button variant="primary" disabled={!both} onClick={() => judge(true)}>{t.correct}</Button><Button disabled={!both} onClick={() => judge(false)}>{t.incorrect}</Button></div></section><p className="caption">{t.attempt} <bdi>{challenge.attempt} / {challenge.maxAttempts}</bdi></p></div></div></>}
        {challenge.outcome && <p className="caption" role="status">{challenge.outcome === 'qualified' && (event.config.prizeCount === 0 || event.rounds.at(-1)?.outcome === 'no-winner') ? j.successOnly : t[challenge.outcome]}</p>}
        <div className="action-row"><Button variant="primary" disabled={!!active} onClick={() => send({ type: 'show-prizes' })}>{j.prizes}</Button>{canRestart(event, now) && <Button onClick={() => confirm(j.confirmRestart, { type: 'restart', now: performance.now(), confirmed: true }, resetChallenge)}>{j.restart}</Button>}</div>
      </>}
      {event.stage === 'prizes' && <section className="prizes-body">
        {event.config.prizeCount > 0 && <div className="field recipient"><label htmlFor="recipient">{j.winners}</label><select id="recipient" value={winner ?? ''} onChange={e => setWinner(e.target.value || null)}><option value="">{j.chooseWinner}</option>{qualifierRows.map(p => <option key={p.id} value={p.id} disabled={event.awards.some(a => a.winnerId === p.id)}>{p.name}{event.awards.some(a => a.winnerId === p.id) ? ` · ${j.awarded}` : ''}</option>)}</select></div>}
        {event.config.prizeCount === 0 ? <p className="empty-state panel">{j.empty}</p> : <section className="prize-grid panel"><h2>{j.prizes} · {event.config.prizeCount}</h2><div className="prize-cards">{prizePage.map((p, i) => { const award = event.awards.find(a => a.prizeId === p.id); const recipient = event.participants.find(x => x.id === award?.winnerId); return <Button key={p.id} className="prize-card" disabled={!!award} onClick={() => confirm(winner ? `${j.confirmOpen} · ${event.participants.find(x => x.id === winner)?.name}` : j.confirmUnassigned, { type: 'open-prize', prizeId: p.id, winnerId: winner, confirmed: true }, () => setWinner(null))}><span>{j.prize}</span><bdi>{page * size + i + 1}</bdi>{award ? <><span dir="auto">{p.name}</span><span>{recipient?.name ?? j.noRecipient}</span></> : <><img src={`/assets/${theme}-prize.svg`} alt="" width="32" height="32" /><span className="caption">{j.unopened}</span></>}</Button>; })}</div>{pagination(pages)}</section>}
        <div className="action-row"><Button disabled={event.awards.length > 0} onClick={() => send({ type: 'back-live' })}>{j.backLive}</Button><Button variant="primary" onClick={() => unopenedPrizeCount(event) ? confirm(j.confirmClosing, { type: 'closing', confirmed: true }) : send({ type: 'closing' })}>{j.closing}</Button></div>{event.awards.length > 0 && <p className="caption">{j.locked}</p>}{canRestart(event, now) && <Button onClick={() => confirm(j.confirmRestart, { type: 'restart', now: performance.now(), confirmed: true }, resetChallenge)}>{j.restart}</Button>}
      </section>}
      {(event.stage === 'closing' || event.stage === 'completed') && <section className="closing-body"><h2>{j.farewell}</h2><section className="results panel">{resultRows.length === 0 ? <p>{j.emptyResults}</p> : resultRows.slice(page, page + 1).map(p => { const a = event.awards.find(a => a.winnerId === p.id); const prize = event.prizeDefinitions.find(x => x.id === a?.prizeId); return <article className="winner-row panel" key={p.id}><p>{p.name}</p><p className="caption" dir="ltr">{j.unverified}: {p.id}</p><p>{prize ? `${j.awarded}: ${prize.name}` : j.noWinner}</p></article>; })}{pagination(resultPages)}{event.stage === 'closing' && unopenedPrizeCount(event) > 0 && <p className="caption">{j.unopened}: {unopenedPrizeCount(event)}</p>}<Button onClick={copySummary}>{j.copy}</Button><p className="caption">{j.retention}</p></section><div className="action-row">{event.stage === 'closing' && <><Button onClick={() => send({ type: 'back-prizes' })}>{j.backPrizes}</Button><Button variant="primary" onClick={() => confirm(j.confirmEnd, { type: 'complete', confirmed: true })}>{j.end}</Button></>}</div>{notice && <><p role="status">{notice}</p>{notice === j.copyFailed && <textarea readOnly aria-label={j.copy} value={summary || j.emptyResults} />}</>}</section>}
      <p className="caption specimen-label">{j.local}</p>
    </main>
    <dialog ref={dialog} className="confirmation panel" aria-labelledby="confirmation-title" onKeyDown={e => {
      if (e.key !== 'Tab') return;
      const buttons = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    }} onCancel={e => { e.preventDefault(); setConfirmation(null); }}><h2 id="confirmation-title">{confirmation?.text}</h2><div className="action-row"><Button autoFocus onClick={() => setConfirmation(null)}>{j.cancel}</Button><Button variant="primary" onClick={() => { if (confirmation) { send(confirmation.action.type === 'restart' ? { ...confirmation.action, now: performance.now() } : confirmation.action); confirmation.after?.(); setConfirmation(null); } }}>{j.confirm}</Button></div></dialog>
  </>;
}
