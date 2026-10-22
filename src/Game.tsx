import { useEffect, useReducer, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { manualGameReducer, initialManualState, validDuration, winnerNameError } from './manual-game';
import type { ManualConfig } from './manual-game';
import { parsePrizeLines } from './prize-lines';
import type { Locale } from './i18n';
import { initialDrawBag, nextPair } from './local-draw';
import './game.css';
import { WinnerList, WinnerNumber, WinnerIcon } from './WinnerList';
import type { ManualWinner } from './manual-game';
import { PrizeReveal } from './PrizeReveal';
import { AnimatedSwitch, HelpTip, InterfaceIcon, NumberStepper } from './InterfaceControls';

const words = {
  ar: { title: 'سؤال وشرط', setup: 'لوحة تحكم المقدم', timer: 'إعدادات الوقت', duration: 'مدة المؤقت', enabled: 'تفعيل المؤقت', attempts: 'المحاولات', prizes: 'الجوائز المتاحة', prizeHint: 'أدخل الجوائز', start: 'بدء الفعالية', exit: 'العودة إلى بُعد', correct: 'صحيحة', wrong: 'خاطئة', question: 'سؤال', condition: 'شرط', reveal: 'اكشف', waiting: 'انقر على البطاقات لكشفها…', answer: 'في انتظار الإجابة…', expired: 'انتهى الوقت · بانتظار حكم المقدم', winners: 'الفائزون', winnerTitle: 'تسجيل الفائز', winnerName: 'اسم الفائز', save: 'إضافة الفائز', cancel: 'إلغاء', close: 'إغلاق', nameLong: 'الحد الأقصى 80 حرفًا', empty: 'لا يوجد فائزون بعد', prizePage: 'صفحة الجوائز', prize: 'جائزة', choose: 'اختر الفائز', award: 'اكشف الجائزة', assigned: 'مُنحت إلى', back: 'العودة للفعالية', finish: 'إنهاء الفعالية', finishTitle: 'إنهاء الفعالية؟', finishNote: 'ستظهر النتائج الحالية. لا يمكن الرجوع أو تعديل الجوائز بعد الإنهاء.', confirm: 'إنهاء وعرض النتائج', thanks: 'شكرًا لكم على المشاركة', results: 'نتائج الفعالية', copy: 'نسخ النتائج', copied: 'نُسخت النتائج', copyError: 'تعذر النسخ؛ يمكنك تحديد النتائج أدناه', new: 'تجربة جديدة', practice: 'تجربة محلية · لا يُخصم أي Slot ولا تُحفظ الأسماء بعد مغادرة الصفحة', noPrizes: 'لم تُضف جوائز لهذه التجربة', full: 'اكتمل عدد الفائزين. انتقل إلى صفحة الجوائز.', error: 'اختر مدة صحيحة من 3 إلى 30 ثانية', count: 'جوائز', unawarded: 'لم تُمنح جائزة', attempt: 'المحاولة', finished: 'الختام', rangeNote: '3–30 ثانية', nameHint: 'اسم يدخله المقدم، دون تحقق من هوية Discord' },
  en: { title: 'Question & Condition', setup: 'Host control panel', timer: 'Timer settings', duration: 'Timer duration', enabled: 'Enable timer', attempts: 'Attempts', prizes: 'Available prizes', prizeHint: 'Enter prizes', start: 'Start event', exit: 'Back to BU’D', correct: 'Correct', wrong: 'Incorrect', question: 'Question', condition: 'Condition', reveal: 'Reveal', waiting: 'Click the cards to reveal them…', answer: 'Waiting for an answer…', expired: 'Time ended · awaiting host judgment', winners: 'Winners', winnerTitle: 'Register winner', winnerName: 'Winner name', save: 'Add winner', cancel: 'Cancel', close: 'Close', nameLong: 'Maximum 80 characters', empty: 'No winners yet', prizePage: 'Prize page', prize: 'Prize', choose: 'Choose winner', award: 'Reveal prize', assigned: 'Awarded to', back: 'Back to event', finish: 'End event', finishTitle: 'End this event?', finishNote: 'Current results will be shown. You cannot go back or change prizes after ending.', confirm: 'End and view results', thanks: 'Thanks for taking part', results: 'Event results', copy: 'Copy results', copied: 'Results copied', copyError: 'Copy failed; select the results below', new: 'New rehearsal', practice: 'Local rehearsal · no Slot deduction; names are not saved after leaving the page', noPrizes: 'No prizes added to this rehearsal', full: 'All winner places are filled. Continue to the prize page.', error: 'Choose a whole number from 3 to 30 seconds', count: 'prizes', unawarded: 'No prize awarded', attempt: 'Attempt', finished: 'Closing', rangeNote: '3–30 seconds', nameHint: 'A host-entered name, without Discord identity verification' },
} as const;
// Illustrative question bank only. Production content/version approval is a separate gate.
const banks = {
  ar: { questions: ['دولة', 'تطبيق جوال', 'شيء تأخذه في رحلة', 'مدينة', 'حيوان', 'أكلة'], conditions: ['تبدأ بحرف «س»', 'تحتوي على حرف «م»', 'من كلمتين', 'تبدأ بحرف «ب»', 'تحتوي على حرف «ر»', 'من أربعة أحرف أو أكثر'] },
  en: { questions: ['A country', 'A mobile app', 'Something you take on a trip', 'A city', 'An animal', 'A food'], conditions: ['Starts with S', 'Contains M', 'Two words', 'Starts with B', 'Contains R', 'At least four letters'] },
};
type Props = { onExit?: () => void; locale?: Locale };
function Mark({ className = '' }: { className?: string }) { return <img className={className} src="/assets/bud-emblem.svg" width="32" height="23" alt="" />; }
function JudgmentIcon({ correct }: { correct: boolean }) { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="9" />{correct ? <path d="m7 12 3 3 7-7" /> : <path d="m8 8 8 8m0-8-8 8" />}</svg>; }

function GameDialog({ open, title, onClose, children, className = '', initialFocus = '[data-autofocus]' }: { open: boolean; title: string; onClose: () => void; children: ReactNode; className?: string; initialFocus?: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const restore = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const element = dialog.current;
    if (open && element && !element.open) { restore.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; element.showModal(); }
    else if (!open && element?.open) {
      element.close();
      const target = restore.current;
      if (target?.isConnected && !target.matches(':disabled')) target.focus();
      else document.querySelector<HTMLElement>('.mg-header h1')?.focus();
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
  }}><h2>{title}</h2>{children}</dialog>;
}

export default function Game({ onExit, locale = 'ar' }: Props) {
  const [state, dispatch] = useReducer(manualGameReducer, undefined, initialManualState);
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
  const [manualOpen, setManualOpen] = useState(false);
  const [managementReturnId, setManagementReturnId] = useState('');
  const [celebration, setCelebration] = useState(true);
  const [result, setResult] = useState<{ name: string; winner: ManualWinner | null } | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [notice, setNotice] = useState('');
  const [draw, setDraw] = useState(() => nextPair(initialDrawBag(), banks.ar.questions.length, banks.ar.conditions.length));
  const previousRound = useRef(state.round);
  const heading = useRef<HTMLHeadingElement>(null);
  const previousPhase = useRef(state.phase);
  const t = words[locale];
  const parsed = parsePrizeLines(prizeText);
  const nameError = winnerNameError(state, name);
  const both = state.question && state.condition;
  const full = state.prizes.length > 0 && state.winners.length >= state.prizes.length;
  const selectedPrize = state.prizes.find(prize => prize.id === prizeId);
  const ar = locale === 'ar';
  const selectedWinner = state.winners.find(w => w.id === winnerId && !state.prizes.some(p => p.winnerId === w.id));
  const manageClose = () => { setViewWinners(false); setEditingWinner(null); setDeletingWinner(null); setAddingWinner(false); setAddedName(''); };
  const unnamedPrizes = state.prizes.filter(p => p.revealed && !p.winnerId);
  const startAdding = () => { setViewWinners(true); setAddingWinner(true); setAddedName(''); setEditingWinner(null); setDeletingWinner(null); setManagementReturnId(''); };
  const summary = [...state.winners.map(winner => `${winner.name} — ${state.prizes.find(prize => prize.winnerId === winner.id)?.name ?? t.unawarded}`), ...unnamedPrizes.map(p => `${ar ? 'دون اسم' : 'No recipient'} — ${p.name}`)].join('\n');
  useEffect(() => {
    if (previousPhase.current !== state.phase) { previousPhase.current = state.phase; heading.current?.focus(); setNotice(''); }
  }, [state.phase]);
  useEffect(() => {
    if (previousRound.current !== state.round) { previousRound.current = state.round; setDraw(previous => nextPair(previous.bag, banks.ar.questions.length, banks.ar.conditions.length)); }
  }, [state.round]);
  useEffect(() => {
    if (state.deadline === null || state.pendingWinner || state.phase !== 'live') return;
    const tick = () => dispatch({ type: 'tick', now: performance.now() });
    const interval = window.setInterval(tick, 100);
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', tick); };
  }, [state.deadline, state.pendingWinner, state.phase]);
  const closeWinner = () => { dispatch({ type: 'cancel-winner' }); setName(''); };
  const copyResults = async () => { try { await navigator.clipboard.writeText(summary || t.empty); setNotice(t.copied); } catch { setNotice(t.copyError); } };
  const prizeDialogClose = () => setPrizeId(null);
  const renderCard = (kind: 'question' | 'condition', index: number) => {
    const revealed = state[kind];
    const content = kind === 'question' ? banks[locale].questions[draw.pair[0]] : banks[locale].conditions[draw.pair[1]];
    return <button type="button" key={kind} className={`mg-card mg-card--${kind}`} data-revealed={revealed} aria-label={`${t.reveal} ${t[kind]}`} aria-pressed={revealed} disabled={revealed || state.pendingWinner} onClick={() => dispatch({ type: 'reveal', card: kind, now: performance.now() })}>
      <span className="mg-flip-inner">
        <span className="mg-card-face mg-card-hidden" aria-hidden={revealed}><Mark className="mg-corner mg-corner-top" /><span className="mg-hidden-center"><b>{index === 0 ? 'Q' : 'C'}</b><span>{t[kind]}</span></span><Mark className="mg-corner mg-corner-bottom" /></span>
        <span className="mg-card-face mg-card-visible" aria-hidden={!revealed}><span className="mg-face-title">{locale === 'ar' ? `بطاقة ${t[kind]}` : t[kind]}</span><Mark className="mg-corner mg-corner-top" /><strong className="mg-card-content">{content}</strong><span className="mg-face-footer">{t[kind]}</span><Mark className="mg-corner mg-corner-bottom" /></span>
      </span>
    </button>;
  };
  return <main className={`manual-game manual-phase-${state.phase}`} dir={locale === 'ar' ? 'rtl' : 'ltr'} lang={locale}>
    <header className="mg-header"><button className="mg-icon-button mg-exit" aria-label={t.exit} title={t.exit} onClick={onExit}><InterfaceIcon kind="exit" /></button><h1 ref={heading} tabIndex={-1}>{t.title}</h1>{state.phase !== 'setup' && <div className="mg-toolbar"><button className="mg-button" onClick={() => setViewWinners(true)}>{t.winners} <bdi>({state.winners.length}{state.prizes.length > 0 ? `/${state.prizes.length}` : ''})</bdi></button>{state.phase === 'live' && <button className="mg-button mg-primary" onClick={() => dispatch({ type: 'phase', phase: 'prizes' })}>{t.prizePage}</button>}</div>}</header>
    {state.phase === 'setup' && <section className="mg-setup">
      <div className="mg-intro"><h2>{t.setup}</h2></div>
      <form onSubmit={event => { event.preventDefault(); if (validDuration(config.duration) && parsed.valid) dispatch({ type: 'start', config, prizeText }); }}>
        <div className="mg-setup-grid"><fieldset className="mg-panel"><legend>{t.timer}</legend>
          <div className="mg-field-label mg-timer-toggle"><AnimatedSwitch label={t.enabled} checked={config.timerEnabled} onCheckedChange={timerEnabled => setConfig({ ...config, timerEnabled, duration: validDuration(config.duration) ? config.duration : 5 })} /><HelpTip label={ar ? 'توضيح المؤقت' : 'About the timer'}>{ar ? 'المؤقت اختياري. يبدأ بعد كشف بطاقتي السؤال والشرط، ولا يحكم على الإجابة تلقائيًا.' : 'Optional: starts after both cards are revealed and never judges the answer automatically.'}</HelpTip></div>
          {config.timerEnabled && <div className="mg-timer-settings"><div className="mg-field-label"><label htmlFor="mg-duration">{t.duration}</label><HelpTip label={ar ? 'توضيح مدة المؤقت' : 'About timer duration'}>{ar ? 'اختر عدد الثواني من 3 إلى 30 ثانية، أو اكتب المدة مباشرة.' : 'Choose 3–30 seconds using the slider or enter the duration directly.'}</HelpTip></div><div className="mg-duration-row"><input id="mg-duration" type="range" aria-label={t.duration} min="3" max="30" step="1" value={Number.isFinite(config.duration) ? config.duration : 5} onChange={event => setConfig({ ...config, duration: Number(event.target.value) })} /><input type="number" aria-label={t.duration} min="3" max="30" step="1" required value={Number.isFinite(config.duration) ? config.duration : ''} onChange={event => setConfig({ ...config, duration: event.target.value === '' ? NaN : Number(event.target.value) })} /><span className="mg-help">{ar ? 'ثانية' : 'sec'}</span></div>{!validDuration(config.duration) && <p role="alert">{t.error}</p>}</div>}
          <div className="mg-field-label"><label htmlFor="mg-attempts">{t.attempts}</label><HelpTip label={ar ? 'توضيح المحاولات' : 'About attempts'}>{ar ? 'عدد المحاولات المتاحة للجولة: من محاولة واحدة إلى ثلاث. بعد الإجابة الخاطئة تُكشف بطاقتان جديدتان.' : 'Choose one to three attempts per round. An incorrect answer leads to a fresh pair of cards.'}</HelpTip></div><NumberStepper id="mg-attempts" label={t.attempts} value={config.attempts} min={1} max={3} locale={locale} onChange={attempts => setConfig({ ...config, attempts: attempts as ManualConfig['attempts'] })} />
        </fieldset><fieldset className="mg-panel"><legend>{t.prizes} <bdi className="mg-count">{parsed.count} {t.count}</bdi></legend><div className="mg-field-label"><label htmlFor="mg-prizes">{t.prizeHint}</label><HelpTip label={ar ? 'توضيح الجوائز' : 'About prizes'}>{ar ? 'كل سطر غير فارغ يُحتسب جائزة مستقلة، وعدد الجوائز هو الحد الأقصى للفائزين. حتى 50 جائزة و100 حرف لكل جائزة. إذا تركتها فارغة يمكنك التجربة دون جوائز.' : 'Each non-empty line counts as one prize and sets the maximum winner count. Up to 50 prizes and 100 characters per prize. Leave empty to rehearse without prizes.'}</HelpTip></div><textarea id="mg-prizes" rows={5} maxLength={6000} placeholder={locale === 'ar' ? 'جائزة 1\nجائزة 2' : 'Prize 1\nPrize 2'} value={prizeText} onChange={event => setPrizeText(event.target.value)} />{!parsed.valid && <p role="alert">{locale === 'ar' ? 'الحد الأقصى 50 جائزة، و100 حرف لكل جائزة' : 'Up to 50 prizes; 100 characters per prize'}</p>}</fieldset></div>
        <div className="mg-panel mg-start"><button className="mg-button mg-primary" type="submit" disabled={!parsed.valid || !validDuration(config.duration)}>{t.start}</button></div>
      </form>
    </section>}
    {state.phase === 'live' && <section className="mg-live" aria-label={t.title}>
      {state.config.timerEnabled && <div className="mg-timer" data-expired={state.remaining === 0} role="timer" aria-label={t.duration}><bdi>{state.remaining}</bdi></div>}
      <div className="mg-cards">{renderCard('question', 0)}{renderCard('condition', 1)}</div>
      <p className="mg-live-status" role="status">{full ? t.full : !both ? t.waiting : state.config.timerEnabled && state.remaining === 0 ? t.expired : t.answer}</p>
      {both && <div className="mg-judgment mg-panel"><button className="mg-button mg-correct" disabled={full || state.pendingWinner} onClick={() => dispatch({ type: 'correct' })}><JudgmentIcon correct />{t.correct}</button><button className="mg-button mg-wrong" disabled={state.pendingWinner} onClick={() => dispatch({ type: 'wrong' })}><JudgmentIcon correct={false} />{t.wrong}</button>{state.config.attempts > 1 && <span className="mg-help">{t.attempt} <bdi>{state.attempt}/{state.config.attempts}</bdi></span>}</div>}
    </section>}
    {state.phase === 'prizes' && <section className="mg-prizes-screen" aria-label={t.prizePage}>
      <aside className="mg-panel mg-winners-sidebar" aria-labelledby="mg-sidebar-title">
        <h2 id="mg-sidebar-title"><WinnerIcon kind="people" />{ar ? 'قائمة الفائزين' : 'Winner list'}</h2>
        <WinnerList winners={state.winners} prizes={state.prizes} locale={locale} selectedId={winnerId} onSelect={id => { setWinnerId(id); setManualOpen(false); }} />
        {!state.winners.length && <p className="mg-help">{ar ? 'أضف فائزًا أو اختر الفتح دون اسم.' : 'Add a winner or choose to open without a name.'}</p>}
        <button className="mg-button" disabled={full} onClick={startAdding}>{ar ? 'إضافة فائز' : 'Add a winner'}</button>
        {full && <p className="mg-help">{ar ? 'اكتمل العدد؛ احذف سجلًا من الفائزين لإضافة بديل.' : 'Capacity reached; delete a winner record to add a replacement.'}</p>}
        <button className="mg-button mg-manual-open" aria-pressed={manualOpen} onClick={() => { setManualOpen(!manualOpen); setWinnerId(''); }}>{ar ? 'فتح دون اسم' : 'Open without a name'}</button>
      </aside>
      <div className="mg-prize-stage">
        <div className="mg-draw-status" role="status">{manualOpen ? <span>{ar ? 'فتح يدوي دون تخصيص اسم — اختر بطاقة جائزة' : 'Manual opening without a recipient — choose a prize card'}</span> : selectedWinner ? <><span>{ar ? 'السحب الآن لـ' : 'Drawing for'}</span><strong dir="auto">{selectedWinner.name}</strong><WinnerNumber id={selectedWinner.id} /><small>{ar ? 'اختر بطاقة لفتح جائزته' : 'Choose a card to open their prize'}</small></> : <span>{state.winners.length && state.winners.every(w => state.prizes.some(p => p.winnerId === w.id)) ? (ar ? 'حصل جميع الفائزين على جوائزهم' : 'All winners have received their prizes') : (ar ? 'اختر فائزًا من القائمة ثم اختر بطاقة جائزة' : 'Choose a winner from the list, then a prize card')}</span>}</div>
        <div className="mg-panel mg-prize-board">{state.prizes.length === 0 ? <p>{t.noPrizes}</p> : <div className="mg-prize-grid">{state.prizes.map((prize, index) => {
          const recipient = state.winners.find(w => w.id === prize.winnerId);
          return <button type="button" className="mg-prize-card" data-revealed={prize.revealed} key={prize.id} disabled={prize.revealed || (!selectedWinner && !manualOpen)} aria-label={prize.revealed ? [t.prize, index + 1, prize.name, recipient?.name ?? (ar ? 'دون اسم' : 'No recipient')].join(' ') : [ar ? 'فتح الجائزة' : 'Open prize', index + 1].join(' ')} onClick={() => setPrizeId(prize.id)}>
            {prize.revealed ? <><span className="mg-prize-recipient"><strong dir="auto">{recipient?.name ?? (ar ? 'دون اسم' : 'No recipient')}</strong>{recipient && <WinnerNumber id={recipient.id} />}</span><span className="mg-prize-ribbon" dir="auto">{prize.name}</span><small>{ar ? 'تم فتح الجائزة' : 'Prize opened'}</small></> : <><WinnerIcon kind="gift" /><bdi className="mg-prize-index">{index + 1}</bdi></>}
          </button>;
        })}</div>}</div>
        <div className="mg-draw-footer"><label className="mg-toggle"><input type="checkbox" checked={celebration} onChange={e => setCelebration(e.target.checked)} />{ar ? 'مؤثرات الاحتفال' : 'Celebration effects'}</label><div className="mg-actions"><button className="mg-button" disabled={state.prizes.some(prize => prize.revealed)} onClick={() => dispatch({ type: 'phase', phase: 'live' })}>{t.back}</button><button className="mg-button mg-primary" onClick={() => setConfirmEnd(true)}>{t.finish}</button></div></div>
      </div>
    </section>}
    {state.phase === 'closing' && <section className="mg-closing"><h2>{t.thanks}</h2><div className="mg-panel"><h3>{t.results}</h3>{state.winners.length === 0 ? <p>{t.empty}</p> : <ul className="mg-results">{state.winners.map(winner => <li key={winner.id}><strong dir="auto">{winner.name}</strong><span dir="auto">{state.prizes.find(prize => prize.winnerId === winner.id)?.name ?? t.unawarded}</span></li>)}</ul>}{unnamedPrizes.length > 0 && <div className="mg-unnamed-results"><h4>{ar ? 'جوائز فُتحت دون اسم' : 'Prizes opened without a recipient'}</h4><ul>{unnamedPrizes.map(prize => <li key={prize.id} dir="auto">{prize.name}</li>)}</ul></div>}<button className="mg-button" onClick={copyResults}>{t.copy}</button>{notice && <p role="status">{notice}</p>}{notice === t.copyError && <textarea readOnly value={summary} aria-label={t.results} />}</div><button className="mg-button mg-primary" onClick={() => { dispatch({ type: 'reset' }); setPrizeText(''); setName(''); setManualOpen(false); setWinnerId(''); setManagementReturnId(''); }}>{t.new}</button></section>}
    <footer className="mg-disclosure">{t.practice}</footer>
    <GameDialog open={state.pendingWinner} title={t.winnerTitle} onClose={closeWinner}><form onSubmit={event => { event.preventDefault(); if (!nameError) { dispatch({ type: 'save-winner', name }); setName(''); } }}><label htmlFor="mg-winner-name">{t.winnerName}</label><input id="mg-winner-name" autoFocus data-autofocus required autoComplete="off" maxLength={80} value={name} onChange={event => setName(event.target.value)} /><p className="mg-help">{t.nameHint}</p>{nameError === 'long' && <p role="alert">{t.nameLong}</p>}<div className="mg-actions"><button className="mg-button mg-primary" type="submit" disabled={!!nameError}>{t.save}</button><button className="mg-button" type="button" onClick={closeWinner}>{t.cancel}</button></div></form></GameDialog>
    <GameDialog open={viewWinners} title={t.winners} onClose={manageClose} className="mg-management" initialFocus={addingWinner ? '#mg-add-name' : editingWinner ? '#mg-edit-name' : deletingWinner ? '[data-autofocus]' : managementReturnId ? `[data-winner-id="${managementReturnId}"] button` : '.mg-dialog-close'}>
      <button className="mg-icon-button mg-dialog-close" aria-label={t.close} onClick={manageClose}>×</button>
      <div className="mg-management-mark" aria-hidden="true"><WinnerIcon kind="trophy" /></div>
      {addingWinner ? <form onSubmit={event => { event.preventDefault(); if (full || winnerNameError(state, addedName)) return; const id = `winner-${state.nextWinnerNumber}`; dispatch({ type: 'add-winner', name: addedName }); setManagementReturnId(id); setAddingWinner(false); setAddedName(''); }}>
        <label htmlFor="mg-add-name">{t.winnerName}</label><input id="mg-add-name" data-autofocus autoFocus required maxLength={80} value={addedName} onChange={event => setAddedName(event.target.value)} /><div className="mg-actions"><button type="submit" className="mg-button mg-primary" disabled={full || !!winnerNameError(state, addedName)}>{t.save}</button><button type="button" className="mg-button" onClick={() => setAddingWinner(false)}>{t.cancel}</button></div>
      </form> : editingWinner ? <form onSubmit={e => { e.preventDefault(); if (!winnerNameError(state, editName)) { dispatch({ type: 'rename-winner', winnerId: editingWinner.id, name: editName }); setEditingWinner(null); } }}>
        <label htmlFor="mg-edit-name">{ar ? 'تعديل اسم الفائز' : 'Edit winner name'} <WinnerNumber id={editingWinner.id} /></label><input key={editingWinner.id} autoFocus data-autofocus id="mg-edit-name" required maxLength={80} value={editName} onChange={e => setEditName(e.target.value)} /><div className="mg-actions"><button type="submit" className="mg-button mg-primary" disabled={!!winnerNameError(state, editName)}>{ar ? 'حفظ التعديل' : 'Save changes'}</button><button type="button" className="mg-button" onClick={() => setEditingWinner(null)}>{t.cancel}</button></div>
      </form> : deletingWinner ? <div><p>{ar ? 'حذف سجل الفائز' : 'Delete winner record'} <strong dir="auto">{deletingWinner.name}</strong> <WinnerNumber id={deletingWinner.id} />؟</p>{state.prizes.some(p => p.winnerId === deletingWinner.id) && <p className="mg-help">{ar ? 'ستُعاد جائزته إلى البطاقات المتاحة للسحب.' : 'Their prize will return to the available draw cards.'}</p>}<div className="mg-actions"><button className="mg-button" autoFocus data-autofocus onClick={() => setDeletingWinner(null)}>{t.cancel}</button><button className="mg-button mg-primary" onClick={() => { dispatch({ type: 'delete-winner', winnerId: deletingWinner.id }); if (winnerId === deletingWinner.id) setWinnerId(''); setDeletingWinner(null); }}>{ar ? 'تأكيد الحذف' : 'Confirm deletion'}</button></div></div> : <><WinnerList winners={state.winners} prizes={state.prizes} locale={locale} readOnly={state.phase === 'closing'} onEdit={winner => { setManagementReturnId(winner.id); setEditingWinner(winner); setEditName(winner.name); }} onDelete={winner => { setManagementReturnId(winner.id); setDeletingWinner(winner); }} />{state.phase !== 'closing' && <><button className="mg-button mg-primary" disabled={full} onClick={startAdding}>{ar ? 'إضافة فائز' : 'Add a winner'}</button>{full && <p className="mg-help">{ar ? 'اكتمل عدد الفائزين؛ احذف سجلًا لإضافة بديل.' : 'Winner capacity reached; delete a record to add a replacement.'}</p>}</>}</>}
    </GameDialog>
    <GameDialog open={!!selectedPrize && (!!selectedWinner || manualOpen)} title={ar ? 'تأكيد فتح الجائزة' : 'Confirm opening prize'} onClose={prizeDialogClose} className="mg-award-confirm">
      <div className="mg-confirm-gift"><WinnerIcon kind="gift" /></div>
      <p>{manualOpen ? (ar ? 'هل تريد فتح الجائزة دون تخصيصها لفائز؟' : 'Open this prize without assigning a recipient?') : (ar ? 'هل أنت متأكد من فتح هذه الجائزة لـ' : 'Open this prize for')}</p>
      {selectedWinner && <p className="mg-confirm-winner"><strong dir="auto">{selectedWinner.name}</strong> <WinnerNumber id={selectedWinner.id} /></p>}
      <p className="mg-help">{t.prize} <bdi>{state.prizes.findIndex(p => p.id === prizeId) + 1}</bdi> · {manualOpen ? (ar ? 'ستُكشف فقط ولن ترتبط بأي اسم' : 'Revealed only; no name will be assigned') : (ar ? 'ستُربط بهذا السجل بعد التأكيد' : 'Assigned to this record after confirmation')}</p>
      <div className="mg-actions"><button className="mg-button mg-primary" disabled={!selectedPrize || (!selectedWinner && !manualOpen)} onClick={() => {
        if (!selectedPrize || selectedPrize.revealed || (!selectedWinner && !manualOpen)) return;
        if (manualOpen) dispatch({ type: 'open-prize', prizeId: selectedPrize.id });
        else if (selectedWinner) dispatch({ type: 'award', prizeId: selectedPrize.id, winnerId: selectedWinner.id });
        setResult({ name: selectedPrize.name, winner: selectedWinner ? { ...selectedWinner } : null }); setPrizeId(null); setWinnerId('');
      }}>{manualOpen ? (ar ? 'افتح دون اسم!' : 'Open without a name!') : (ar ? 'افتح جائزته!' : 'Open their prize!')}</button><button className="mg-button" autoFocus data-autofocus onClick={prizeDialogClose}>{t.cancel}</button></div>
    </GameDialog>
    <GameDialog open={!!result} title={ar ? 'لحظة الجائزة' : 'Your prize moment'} onClose={() => setResult(null)} className="mg-award-result">
      {result && <PrizeReveal name={result.name} winner={result.winner} locale={locale} celebration={celebration} onClose={() => setResult(null)} />}
    </GameDialog>
    <GameDialog open={confirmEnd} title={t.finishTitle} onClose={() => setConfirmEnd(false)}><p>{t.finishNote}</p><div className="mg-actions"><button className="mg-button" autoFocus data-autofocus onClick={() => setConfirmEnd(false)}>{t.cancel}</button><button className="mg-button mg-primary" onClick={() => { dispatch({ type: 'phase', phase: 'closing' }); setConfirmEnd(false); }}>{t.confirm}</button></div></GameDialog>
  </main>;
}
