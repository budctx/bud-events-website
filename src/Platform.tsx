import { useEffect, useRef, useState } from 'react';
import './platform.css';
import { HeroArtwork } from './HeroArtwork';

type Locale = 'ar' | 'en';
type Page = 'home' | 'events' | 'bots' | 'designs';
type Modal = 'qc' | 'soon' | 'about' | 'privacy' | 'terms' | 'support' | 'login' | 'how' | null;
type PlatformProps = { onPlay: (locale: Locale) => void; onBuy?: (locale: Locale) => void };

const copy = {
  ar: { home: 'الرئيسية', events: 'الفعاليات', bots: 'بوتات', designs: 'تصاميم', soon: 'قريبًا', login: 'الدخول عبر Discord', eyebrow: 'تجارب رقمية، بروح مجتمعك', title: <>ننقل تجربتك<br />إلى بُعد آخر</>, description: <>منتجات رقمية لمجتمعك على Discord.<br />ابدأ بالفعاليات، واكتشف ما يأتي بعدها.</>, explore: 'استكشف الفعاليات', about: 'عن بُعد', how: 'كيف تعمل بُعد؟', browseHint: 'تصفّح المنتجات وجرّب الفعالية قبل الشراء.', privacy: 'الخصوصية', terms: 'الشروط', support: 'الدعم', close: 'إغلاق', galleryTitle: 'فعاليات بُعد', galleryDescription: 'اختر الفعالية، وجهّز وقتًا يجمع مجتمعك.', product: 'سؤال وشرط', productEyebrow: 'فعالية صوتية على Discord', productDescription: <>سؤال يختبرك، وشرط يغيّر التحدّي.<br />أدر الفعالية بطريقتك مع مجتمعك.</>, features: 'إدارة للهوست · جوائز · مؤقت اختياري', view: 'عرض الفعالية', buy: 'اشترِ الآن', try: 'جرّب العرض', review: 'آراء المجتمع قريبًا', reviewNote: 'لم تُنشر آراء معتمدة بعد.', partners: 'الشركاء قريبًا', purchaseUnavailable: 'الشراء غير متاح حاليًا. لن يُخصم أي رصيد.', rehearsal: 'عرض تجريبي محلي لتجربة الفعالية، لا يبدأ فعالية مدفوعة.', details: 'اكشف بطاقتي السؤال والشرط، واحكم على الإجابة صوتيًا. بعد الإجابة الصحيحة أدخل اسم الفائز، ثم وزّع الجوائز واختتم الفعالية.', soonDescription: 'نعمل على منتجات جديدة لمجتمعك. ستظهر هنا عند توفرها.', aboutDescription: 'بُعد منصة منتجات رقمية لمجتمعات Discord. ننقل تجربتك إلى بُعد آخر.', legalPending: 'هذه الصفحة قيد الإعداد. ستتوفر التفاصيل المعتمدة قبل تفعيل الشراء.', loginUnavailable: 'تسجيل الدخول والشراء غير متاحين في هذه المعاينة. يمكنك تصفّح المنتجات وتجربة الفعالية دون تسجيل.', changeLanguage: 'English', question: 'سؤال', condition: 'شرط' },
  en: { home: 'Home', events: 'Events', bots: 'Bots', designs: 'Designs', soon: 'Coming soon', login: 'Sign in with Discord', eyebrow: 'Digital experiences, your community’s spirit', title: <>Take your experience<br />to another dimension</>, description: <>Digital products for your Discord community.<br />Start with events. Discover what comes next.</>, explore: 'Explore events', about: 'About BU’D', how: 'How BU’D works', browseHint: 'Browse products and try the event before purchasing.', privacy: 'Privacy', terms: 'Terms', support: 'Support', close: 'Close', galleryTitle: 'BU’D events', galleryDescription: 'Choose an event. Make time for your community.', product: 'Question & Condition', productEyebrow: 'A voice event on Discord', productDescription: <>A question to test you. A condition to change the challenge.<br />Host the event your way with your community.</>, features: 'Host controls · Prizes · Optional timer', view: 'View event', buy: 'Buy now', try: 'Try the demo', review: 'Community stories coming soon', reviewNote: 'No approved reviews published yet.', partners: 'Partners coming soon', purchaseUnavailable: 'Purchasing is currently unavailable. No credits will be deducted.', rehearsal: 'A local rehearsal of the event. This does not start a paid event.', details: 'Reveal the question and condition cards, then judge the spoken answer. After a correct answer, enter the winner’s name, award prizes and close the event.', soonDescription: 'New products for your community are on the way. They will appear here when available.', aboutDescription: 'BU’D is a digital product platform for Discord communities. Take your experience to another dimension.', legalPending: 'This page is being prepared. Approved details will be available before purchasing opens.', loginUnavailable: 'Sign-in and purchasing are unavailable in this preview. You can browse products and rehearse the event without signing in.', changeLanguage: 'العربية', question: 'Question', condition: 'Condition' }
};

function Mark({ className = '' }: { className?: string }) {
  return <span className={`platform-mark ${className}`} aria-hidden="true"><img src="/assets/bud-emblem.svg" alt="" width="32" height="23" /></span>;
}

function CardPreview({ locale }: { locale: Locale }) {
  const t = copy[locale];
  return <div className="platform-product-preview" aria-hidden="true">{(['Q', 'C'] as const).map((letter, i) => <div className={`platform-mini-card platform-mini-card-${letter}`} key={letter}><Mark className="mini-mark-top" /><Mark className="mini-mark-bottom" /><div className="mini-identity"><span>{letter}</span><small>{i === 0 ? t.question : t.condition}</small></div></div>)}</div>;
}

export default function Platform({ onPlay, onBuy }: PlatformProps) {
  const [locale, setLocale] = useState<Locale>(() => { const requested = new URLSearchParams(location.search).get('lang'); try { return (requested ?? localStorage.getItem('bud-lang')) === 'en' ? 'en' : 'ar'; } catch { return requested === 'en' ? 'en' : 'ar'; } });
  const [page, setPage] = useState<Page>('home');
  const [modal, setModal] = useState<Modal>(null);
  const [purchaseStatus, setPurchaseStatus] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const t = copy[locale];
  const main = useRef<HTMLElement>(null);

  useEffect(() => { document.documentElement.lang = locale; document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr'; try { localStorage.setItem('bud-lang', locale); } catch { /* Preferences are optional. */ } }, [locale]);
  useEffect(() => {
    if (!modal || !dialog.current) return;
    const previous = document.activeElement as HTMLElement | null;
    const node = dialog.current;
    const previousOverflow = document.body.style.overflow;
    setPurchaseStatus(false);
    node.showModal();
    document.body.style.overflow = 'hidden';
    return () => { if (node.open) node.close(); document.body.style.overflow = previousOverflow; previous?.focus(); };
  }, [modal]);
  const navigate = (next: Page) => { setPage(next); requestAnimationFrame(() => main.current?.focus({ preventScroll: true })); };
  const buy = () => { if (onBuy) onBuy(locale); else setPurchaseStatus(true); };
  const modalTitle = modal === 'qc' ? t.product : modal === 'soon' ? t.soon : modal ? t[modal] : '';

  return <div className={`platform platform-${page}`} dir={locale === 'ar' ? 'rtl' : 'ltr'} data-testid="platform-root">
    <a className="skip-link" href="#platform-content">{locale === 'ar' ? 'تجاوز إلى المحتوى' : 'Skip to content'}</a>
    <header className="platform-header" data-node-id="339:2072">
      <div className="platform-header-tools"><button type="button" className="platform-login" onClick={() => setModal('login')}>{t.login}</button><button className="platform-language" data-testid="locale-toggle" onClick={() => setLocale(locale === 'ar' ? 'en' : 'ar')} aria-label={t.changeLanguage}>{locale === 'ar' ? 'EN' : 'ع'}</button></div>
      <div className="platform-brand-navigation">
        <nav className="platform-navigation" aria-label={locale === 'ar' ? 'التنقل الرئيسي' : 'Main navigation'}>{(['home', 'events', 'bots', 'designs'] as const).map(item => <button type="button" key={item} data-testid={`nav-${item}`} aria-current={page === item ? 'page' : undefined} className={item === 'bots' || item === 'designs' ? 'platform-future-link' : ''} onClick={() => navigate(item)}>{t[item]}{(item === 'bots' || item === 'designs') && <span> · {t.soon}</span>}</button>)}</nav>
        <button className="platform-brand" aria-label={locale === 'ar' ? 'بُعد — الرئيسية' : 'BU’D — Home'} onClick={() => navigate('home')}><Mark /><span>بُعد</span></button>
      </div>
    </header>
    <main id="platform-content" className={page === 'home' ? 'platform-home-main' : 'platform-gallery-main'} ref={main} tabIndex={-1} key={page}>
      {page === 'home' ? <>
        <section className="platform-hero" data-node-id="339:2099"><p className="platform-eyebrow">{t.eyebrow}</p><h1>{t.title}</h1><p className="platform-hero-description">{t.description}</p><div className="platform-hero-actions"><button className="platform-action platform-action-primary" data-testid="hero-explore" onClick={() => navigate('events')}>{t.explore}<span aria-hidden="true">←</span></button><button className="platform-action platform-action-secondary" data-testid="hero-how" onClick={() => setModal('how')}>{t.how}</button></div><p className="platform-hero-hint">{t.browseHint}</p></section><HeroArtwork />
        <aside className="platform-proof" aria-label={locale === 'ar' ? 'المجتمع والشركاء' : 'Community and partners'} data-node-id="359:2272"><div className="platform-review-empty"><strong>{t.review}</strong><p>{t.reviewNote}</p></div><div className="platform-partners-empty">{t.partners}</div></aside>
      </> : <>
        <div className="platform-gallery-intro"><h1>{page === 'events' ? t.galleryTitle : t[page]}</h1><p>{page === 'events' ? t.galleryDescription : t.soonDescription}</p></div>
        {page === 'events' ? <article className="platform-product-card" data-node-id="383:11116" onClick={event => { event.currentTarget.querySelector<HTMLButtonElement>('button')?.focus(); setModal('qc'); }}><CardPreview locale={locale} /><div className="platform-product-information"><p className="platform-product-eyebrow">{t.productEyebrow}</p><h2>{t.product}</h2><p className="platform-product-description">{t.productDescription}</p><p className="platform-features">{t.features}</p><button className="platform-action platform-action-primary" data-testid="product-card-qc" onClick={() => setModal('qc')}>{t.view}</button></div></article> : <article className="platform-product-card platform-coming-soon"><div><p className="platform-status">{t.soon}</p><h2>{t[page]}</h2><p>{t.soonDescription}</p><button className="platform-action platform-action-secondary" onClick={() => setModal('soon')}>{locale === 'ar' ? 'تفاصيل المنتج' : 'Product details'}</button></div></article>}
      </>}
    </main>
    <footer className="platform-footer"><small>© {locale === 'ar' ? 'بُعد' : 'BU’D'} 2026</small><div className="platform-footer-links">{(['privacy', 'terms', 'support'] as const).map(item => <button key={item} onClick={() => setModal(item)}>{t[item]}</button>)}</div></footer>

    <dialog ref={dialog} className="platform-dialog" data-testid={modal === 'qc' ? 'product-dialog' : 'platform-dialog'} aria-labelledby="platform-dialog-title" onKeyDown={event => {
      if (event.key !== 'Tab') return;
      const items = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')];
      const first = items[0], last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }} onCancel={e => { e.preventDefault(); setModal(null); }} onClick={e => { if (e.target !== e.currentTarget) return; const box = e.currentTarget.getBoundingClientRect(); if (e.clientX < box.left || e.clientX > box.right || e.clientY < box.top || e.clientY > box.bottom) setModal(null); }}>
      <div className="platform-dialog-inner"><button className="platform-dialog-close" data-testid="dialog-close" aria-label={t.close} onClick={() => setModal(null)} autoFocus>×</button><h2 id="platform-dialog-title">{modalTitle}</h2>{modal === 'how' ? <><ol className="platform-how-steps">{(locale === 'ar' ? [['تصفّح منتجات بُعد', 'استكشف الفعاليات والبوتات والتصاميم، وتعرّف على المتاح والقادم.'], ['جرّب الفعالية', 'افتح تفاصيل «سؤال وشرط» وجرّب العرض المحلي دون تسجيل دخول.'], ['أدرها مع مجتمعك', 'جهّز الجوائز والمؤقت، واحكم على الإجابات وسجّل الفائزين بنفسك.']] : [['Explore BU’D products', 'Browse events, bots and designs, with clear available and coming-soon states.'], ['Try an event', 'Open Question & Condition and try the local demo without signing in.'], ['Host for your community', 'Set prizes and a timer, judge answers and record winners yourself.']]).map(([title, description], index) => <li key={title}><bdi>{index + 1}</bdi><div><h3>{title}</h3><p>{description}</p></div></li>)}</ol><button className="platform-action platform-action-primary" data-testid="how-explore" onClick={() => { setModal(null); navigate('events'); }}>{t.explore}</button></> : modal === 'qc' ? <><CardPreview locale={locale} /><p>{t.details}</p><p className="platform-features">{t.features}</p><div className="platform-modal-actions"><button className="platform-action platform-action-primary" data-testid="product-buy" onClick={buy}>{t.buy}</button><button className="platform-action platform-action-secondary" data-testid="product-try" onClick={() => { setModal(null); onPlay(locale); }}>{t.try}</button></div><p className="platform-rehearsal">{t.rehearsal}</p>{purchaseStatus && <p role="status" className="platform-purchase-status">{t.purchaseUnavailable}</p>}</> : <p>{modal === 'about' ? t.aboutDescription : modal === 'soon' ? t.soonDescription : modal === 'login' ? t.loginUnavailable : t.legalPending}</p>}</div>
    </dialog>
  </div>;
}
