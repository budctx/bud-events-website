import {useEffect, useRef, useState} from 'react';
import './mini-games-preview.css';

function shuffledCards() {
  const cards = ['🎮', '⭐', '🎮', '⭐'];
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}

/** Public, browser-only sample: no session, credit or winner state. */
export function MiniGamesPreview() {
  const [cards, setCards] = useState(shuffledCards);
  const [open, setOpen] = useState<number[]>([]);
  const [matched, setMatched] = useState<number[]>([]);
  const first = useRef<HTMLButtonElement>(null);
  const complete = matched.length === 4;
  useEffect(() => {
    if (open.length !== 2) return;
    const timeout = window.setTimeout(() => setOpen([]), 1000);
    return () => window.clearTimeout(timeout);
  }, [open]);
  function reveal(index: number) {
    if (open.length === 2 || open.includes(index) || matched.includes(index)) return;
    if (open.length === 1 && cards[open[0]] === cards[index]) {
      setMatched(previous => [...previous, open[0], index]);
      setOpen([]);
    } else setOpen(previous => [...previous, index]);
  }
  function reset() {
    setOpen([]);
    setMatched([]);
    setCards(shuffledCards());
    first.current?.focus();
  }
  return <section className="mini-demo" dir="rtl" aria-label="جرّب ذاكرة الإيموجي" data-testid="mini-games-demo" data-complete={complete}>
    <div className="mini-demo-heading"><span>ذاكرة الإيموجي</span><small>جرّب واحدة من 6 ألعاب</small></div>
    <div className="mini-demo-cards">{cards.map((emoji, index) => {
      const revealed = open.includes(index) || matched.includes(index);
      return <button key={index} ref={index === 0 ? first : undefined} type="button" className="mini-demo-card" data-revealed={revealed} data-matched={matched.includes(index)} aria-label={revealed ? `البطاقة ${index + 1}: ${emoji}${matched.includes(index) ? '، متطابقة' : ''}` : `اكشف البطاقة ${index + 1}`} aria-disabled={revealed || open.length === 2} onClick={() => reveal(index)}>
        <span className="mini-demo-back" aria-hidden="true"><img src="/assets/bud-emblem.svg" alt=""/></span>
        <span className="mini-demo-front" aria-hidden="true">{revealed ? emoji : ''}</span>
      </button>;
    })}</div>
    <div className="mini-demo-footer"><p role="status">{complete ? 'طابقتها! 🎉' : 'اقلب البطاقات وطابق الإيموجي'}</p><button type="button" className="mini-demo-reset" onClick={reset} disabled={open.length === 0 && matched.length === 0}>جرّب مرة ثانية</button></div>
    {complete && <span className="mini-demo-celebration" aria-hidden="true">{['✦','●','✦','●','✦','●'].map((symbol,index) => <i key={index} style={{insetInlineStart:`${12 + index * 15}%`,animationDelay:`${index * 70}ms`}}>{symbol}</i>)}</span>}
  </section>;
}
