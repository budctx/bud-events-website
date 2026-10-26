import { useEffect, useRef, useState } from 'react';
import { ChevronDown, History, KeyRound, LifeBuoy, LogOut, UserRound, Wallet } from 'lucide-react';
import type { HostSession, Locale } from './host-client';

type AccountMenuProps = {
  session: HostSession;
  locale: Locale;
  credits: number | null;
  busy: boolean;
  onHistory: () => void;
  onLogout: () => void;
  onProfile?: () => void;
  onRedeem?: () => void;
  onSupport?: () => void;
};

// A compact Nav User pattern for the existing React header, without changing auth or routes.
export function AccountMenu({ session, locale, credits, busy, onHistory, onLogout, onProfile, onRedeem, onSupport }: AccountMenuProps) {
  const [open, setOpen] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const ar = locale === 'ar';

  useEffect(() => {
    setOpen(false);
    setImageFailed(false);
  }, [session.id, session.avatarUrl]);

  useEffect(() => {
    if (!open) return;
    const onOutside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onOutside);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('pointerdown', onOutside);
      document.removeEventListener('keydown', onEscape);
    };
  }, [open]);

  const focusItem = (last = false) => {
    requestAnimationFrame(() => {
      const items = Array.from(root.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? []);
      (last ? items[items.length - 1] : items[0])?.focus();
    });
  };
  const select = (action: () => void) => {
    setOpen(false);
    action();
  };
  const avatar = (size: 'small' | 'large') => (
    <span className={`platform-avatar platform-avatar--${size}`}>
      {session.avatarUrl && !imageFailed
        ? <img src={session.avatarUrl} alt="" width={size === 'large' ? 44 : 32} height={size === 'large' ? 44 : 32} referrerPolicy="no-referrer" onError={() => setImageFailed(true)} />
        : <span aria-hidden="true">{Array.from(session.displayName)[0] || '?'}</span>}
    </span>
  );

  return <div className="platform-account" dir={ar ? 'rtl' : 'ltr'} ref={root}
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false); }}
    onKeyDown={event => {
      if (event.key === 'Escape' && open) {
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
        trigger.current?.focus();
      }
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      if (!open) {
        setOpen(true);
        focusItem(event.key === 'ArrowUp' || event.key === 'End');
        return;
      }
      const items = Array.from(root.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? []);
      if (!items.length) return;
      const current = items.indexOf(document.activeElement as HTMLButtonElement);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1
        : event.key === 'ArrowDown' ? (current + 1) % items.length : (current - 1 + items.length) % items.length;
      items[next]?.focus();
    }}>
    <button type="button" ref={trigger} className="platform-account-trigger" aria-expanded={open}
      aria-haspopup="menu" aria-controls="platform-account-menu" disabled={busy}
      aria-label={ar ? `قائمة حساب ${session.displayName}` : `Account menu for ${session.displayName}`}
      onClick={() => setOpen(value => !value)}>
      {avatar('small')}
      <span className="platform-account-name">{session.displayName}</span>
      <ChevronDown className="platform-account-chevron" size={16} strokeWidth={2} aria-hidden="true" />
    </button>

    {open && <div id="platform-account-menu" className="platform-account-menu" role="menu"
      aria-label={ar ? 'قائمة حسابك' : 'Your account'}>
      <div className="platform-account-user" role="presentation">
        {avatar('large')}
        <div className="platform-account-user-text">
          <strong title={session.displayName}>{session.displayName}</strong>
          <span>{ar ? 'متصل عبر Discord' : 'Connected via Discord'}</span>
        </div>
      </div>
      <div className="platform-account-balance" role="presentation">
        <span><Wallet size={17} aria-hidden="true" />{ar ? 'رصيد المفاتيح' : 'Key balance'}</span>
        <strong dir="ltr">{credits === null ? '—' : credits.toLocaleString(ar ? 'ar-SA' : 'en-US')}</strong>
      </div>
      <div className="platform-account-separator" role="separator" />
      {onProfile && <button type="button" role="menuitem" onClick={() => select(onProfile)}>
        <UserRound size={18} aria-hidden="true" />{ar ? 'الملف الشخصي' : 'Profile'}
      </button>}
      <button type="button" role="menuitem" onClick={() => select(onHistory)}>
        <History size={18} aria-hidden="true" />{ar ? 'السجل' : 'History'}
      </button>
      {onRedeem && <button type="button" role="menuitem" onClick={() => select(onRedeem)}>
        <KeyRound size={18} aria-hidden="true" />{ar ? 'استرداد مفتاح' : 'Redeem a key'}
      </button>}
      {onSupport && <button type="button" role="menuitem" onClick={() => select(onSupport)}>
        <LifeBuoy size={18} aria-hidden="true" />{ar ? 'الدعم' : 'Support'}
      </button>}
      <div className="platform-account-separator" role="separator" />
      <button type="button" className="platform-account-logout" role="menuitem" disabled={busy} onClick={() => select(onLogout)}>
        <LogOut size={18} aria-hidden="true" />{ar ? 'تسجيل الخروج' : 'Sign out'}
      </button>
    </div>}
  </div>;
}
