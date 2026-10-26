import { useEffect, useRef, useState } from 'react';
import type { Ref } from 'react';
import type { Locale } from './i18n';
import './event-preview.css';
import { EventCountdown } from './EventCountdown';
import { GameCard } from './GameCard';

/** A fixed product sample. No host configuration, rounds, winners or prize state. */
export function EventPreview({ locale, previewRef }: { locale: Locale; previewRef?: Ref<HTMLElement> }) {
  const ar = locale === 'ar';
  const [question, setQuestion] = useState(false);
  const [condition, setCondition] = useState(false);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(5000);
  const firstCard = useRef<HTMLButtonElement>(null);
  const both = question && condition;
  const expired = both && remaining === 0;
  useEffect(() => {
    if (deadline === null) return;
    const update = () => { const next = Math.max(0, deadline - performance.now()); setRemaining(next); if (next === 0) clearInterval(interval); };
    const interval = window.setInterval(update, 50);
    update();
    document.addEventListener('visibilitychange', update);
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', update); };
  }, [deadline]);
  const reveal = (kind: 'question' | 'condition') => {
    if (kind === 'question') setQuestion(true); else setCondition(true);
    if ((kind === 'question' ? condition : question) && deadline === null) {
      setRemaining(5000); setDeadline(performance.now() + 5000);
    }
  };
  const reset = () => { setQuestion(false); setCondition(false); setDeadline(null); setRemaining(5000); requestAnimationFrame(() => firstCard.current?.focus()); };
  return <section className="qc-demo" dir={ar ? 'rtl' : 'ltr'} ref={previewRef} aria-label={ar ? 'جرّب بطاقتي سؤال وشرط' : 'Try the Question & Condition cards'} data-testid="event-preview">
    <EventCountdown className="qc-demo-timer" duration={5} remaining={remaining / 1000} active={both} label={ar ? 'المؤقت التجريبي' : 'Sample timer'} unit={ar ? 'ث' : 's'} />
    <div className="qc-demo-cards">{(['question', 'condition'] as const).map((kind, index) => {
      const revealed = kind === 'question' ? question : condition;
      const text = ar ? (index === 0 ? 'اذكر دولة' : 'تبدأ بحرف «س»') : (index === 0 ? 'Name a country' : 'Starts with S');
      return <GameCard key={kind} kind={kind} locale={locale} content={text} revealed={revealed} buttonRef={index === 0 ? firstCard : undefined} className="qc-demo-card" onReveal={() => reveal(kind)} />;
    })}</div>
    <p className="qc-demo-hint" role="status">{expired ? (ar ? 'انتهى الوقت! أعد المحاولة بالبطاقتين نفسيهما.' : 'Time’s up! Try the same two cards again.') : both ? (ar ? 'ما الدولة التي تبدأ بحرف س؟' : 'Which country starts with S?') : (ar ? 'اضغط البطاقتين؛ يبدأ المؤقت بعد كشفهما.' : 'Tap both cards; the timer starts once both are revealed.')}</p>
    <button type="button" className="qc-demo-reset" disabled={!question && !condition} onClick={reset}>{ar ? 'إعادة المحاولة' : 'Try again'}</button>
  </section>;
}
