import { useEffect, useRef, useState } from 'react';
import type { HostSession, Locale } from './host-client';

export function AccountMenu({session, locale, busy, onHistory, onLogout, onProfile, onRedeem}: {session: HostSession; locale: Locale; busy: boolean; onHistory: () => void; onLogout: () => void; onProfile?: () => void; onRedeem?: () => void}) {
  const [open, setOpen] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const hoverOpened = useRef(false);
  useEffect(() => setImageFailed(false), [session.avatarUrl]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape);};
  }, [open]);
  return <div className="platform-account" dir={locale === 'ar' ? 'rtl' : 'ltr'} ref={root} onPointerEnter={event => { if (event.pointerType === 'mouse' && !open) {hoverOpened.current = true; setOpen(true);} }} onPointerLeave={event => { hoverOpened.current = false; if (event.pointerType === 'mouse' && !root.current?.querySelector('[role=menu]')?.contains(document.activeElement)) setOpen(false); }} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false); }} onKeyDown={event => {
    if (event.key === 'Escape') { setOpen(false); trigger.current?.focus(); event.stopPropagation(); }
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault(); setOpen(true);
      requestAnimationFrame(() => {
        const items = [...root.current!.querySelectorAll<HTMLButtonElement>('[role=menuitem]')];
        const current = items.indexOf(document.activeElement as HTMLButtonElement);
        const index = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : event.key === 'ArrowDown' ? (current + 1) % items.length : (current - 1 + items.length) % items.length;
        items[index]?.focus();
      });
    }
  }}>
    <button ref={trigger} className="platform-account-trigger" aria-expanded={open} aria-haspopup="menu" aria-controls="platform-account-menu" disabled={busy} onClick={() => { if (hoverOpened.current) {hoverOpened.current = false; setOpen(true);} else setOpen(value => !value); }}>
      <span className="platform-avatar">{session.avatarUrl && !imageFailed ? <img src={session.avatarUrl} alt="" width="32" height="32" referrerPolicy="no-referrer" onError={() => setImageFailed(true)} /> : <span aria-hidden="true">{Array.from(session.displayName)[0]}</span>}</span>
      <span className="platform-account-name">{session.displayName}</span><span aria-hidden="true">⌄</span>
    </button>
    {open && <div id="platform-account-menu" className="platform-account-menu" role="menu" aria-label={locale === 'ar' ? 'حسابك' : 'Your account'}>
      <button role="menuitem" onClick={() => {setOpen(false); onHistory();}}>{locale === 'ar' ? 'السجل' : 'History'}</button>
      {onProfile && <button role="menuitem" onClick={() => {setOpen(false); onProfile();}}>الملف الشخصي</button>}
      {onRedeem && <button role="menuitem" onClick={() => {setOpen(false); onRedeem();}}>استرداد مفتاح</button>}
      <button role="menuitem" disabled={busy} onClick={() => {setOpen(false); onLogout();}}>{locale === 'ar' ? 'تسجيل الخروج' : 'Sign out'}</button>
    </div>}
  </div>;
}
