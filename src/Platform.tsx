import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import './platform.css';
import { HeroArtwork } from './HeroArtwork';
import { InterfaceIcon } from './InterfaceControls';
import { EventPreview } from './EventPreview';
import { Seo } from './Seo';
import { AccountMenu } from './AccountMenu';
import { BudBadge, BudLogoCarousel, BudMagnetic, useBudToast } from './BudUI';
import type { PartnerLogo } from './BudUI';
import { useAccount } from './use-account';
import { HostClientError, newHostRequestKey, purchaseEvent, resumeHostEvent, signInHost } from './host-client';
import PaymentStatus from './PaymentStatus';
import type { PaymentState } from './payment-state';
import type { HostEvent } from './host-client';
const HostPortal = lazy(() => import('./HostPortal'));
const WhopPreflight = lazy(() => import('./WhopPreflight'));
const RedeemDialog = lazy(() => import('./RedeemDialog'));
const Profile = lazy(() => import('./Profile'));
const OwnerPanel = lazy(() => import('./OwnerPanel'));

type Locale = 'ar' | 'en';
type Page = 'home' | 'events' | 'bots' | 'designs';
type Modal = 'soon' | 'about' | 'privacy' | 'terms' | 'support' | 'how' | null;
type PlatformProps = { onPlay: (event: HostEvent, locale: Locale) => void };

const copy = {
  ar: { home: 'الرئيسية', events: 'الفعاليات', bots: 'بوتات', designs: 'تصاميم', soon: 'قريبًا', login: 'سجّل دخولك', eyebrow: 'تجارب رقمية، بروح مجتمعك', title: <>ننقل تجربتك<br />إلى بُعد آخر</>, description: <>منتجات رقمية لمجتمعك على Discord.<br />ابدأ بالفعاليات، واكتشف ما يأتي بعدها.</>, explore: 'استكشف الفعاليات', about: 'عن بُعد', how: 'كيف تبدأ الفعالية؟', browseHint: 'تصفّح المنتجات وجرّب الفعالية قبل الشراء.', privacy: 'الخصوصية', terms: 'الشروط', support: 'الدعم', close: 'إغلاق', galleryTitle: 'فعاليات بُعد', galleryDescription: 'اختر الفعالية، وجهّز وقتًا يجمع مجتمعك.', product: 'سؤال وشرط', productEyebrow: 'فعالية صوتية على Discord', productDescription: <>سؤال يختبرك، وشرط يغيّر التحدّي.<br />أدر الفعالية بطريقتك مع مجتمعك.</>, features: 'إدارة للهوست · جوائز · مؤقت اختياري', view: 'عرض الفعالية', buy: 'اشترِ الآن — ٣ ر.س', review: 'آراء المجتمع قريبًا', reviewNote: 'لم تُنشر آراء معتمدة بعد.', partners: 'الشركاء قريبًا', purchaseUnavailable: 'الشراء غير متاح حاليًا. لن يُخصم أي رصيد.', rehearsal: 'معاينة ببطاقتين ثابتتين ومؤقت 5 ثوانٍ، دون تشغيل فعالية كاملة.', details: 'اكشف بطاقتي السؤال والشرط، واحكم على الإجابة صوتيًا. بعد الإجابة الصحيحة أدخل اسم الفائز، ثم وزّع الجوائز واختتم الفعالية.', soonDescription: 'نعمل على منتجات جديدة لمجتمعك. ستظهر هنا عند توفرها.', aboutDescription: 'بُعد منصة منتجات رقمية لمجتمعات Discord. ننقل تجربتك إلى بُعد آخر.', legalPending: 'هذه الصفحة قيد الإعداد. ستتوفر التفاصيل المعتمدة قبل تفعيل الشراء.', loginUnavailable: 'تسجيل الدخول والشراء غير متاحين في هذه المعاينة. يمكنك تصفّح المنتجات وتجربة البطاقتين دون تسجيل.', changeLanguage: 'English', question: 'سؤال', condition: 'شرط' }

};

function Mark({ className = '' }: { className?: string }) {
  return <span className={`platform-mark ${className}`} aria-hidden="true"><img src="/assets/bud-emblem.svg" alt="" width="32" height="23" /></span>;
}

function pageFromURL(): Page {
  const screen = new URLSearchParams(location.search).get('screen');
  return screen === 'bots' || screen === 'designs' ? screen : ['events', 'host', 'game','local'].includes(screen ?? '') ? 'events' : 'home';
}
export default function Platform({ onPlay }: PlatformProps) {
  const locale: Locale = 'ar';
  const [page, setPage] = useState<Page>(pageFromURL);
  const [modal, setModal] = useState<Modal>(null);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [panel, setPanel] = useState<'history' | 'setup' | 'profile' | 'owner' | null>(null);
  const account = useAccount();
  const toast = useBudToast();
  const [partners,setPartners] = useState<PartnerLogo[]>([]);
  const [redeemOpen,setRedeemOpen]=useState(false);
  const [paymentHold, setPaymentHold] = useState(false);
  const onReceiptState = useCallback((state: PaymentState) => {
    if (['review','refunded','disputed'].includes(state)) setPaymentHold(true);
    void account.refresh();
  }, [account.refresh]);
  const [paymentOrder] = useState(() => {
    const value = new URLSearchParams(location.search).get('order') ?? '';
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) ? value : null;
  });
  const [inspectWhop] = useState(() => new URLSearchParams(location.search).get('check') === 'whop');
  const locked = useRef(false);
  const purchaseKey = useRef<{key:string;locale:Locale} | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const t = copy.ar;
  const main = useRef<HTMLElement>(null);

  useEffect(() => { let mounted=true;fetch('/api/owner?public=partners',{credentials:'omit'}).then(response=>response.ok?response.json():null).then(result=>{if(mounted&&result?.code==='OK'&&Array.isArray(result.data))setPartners(result.data);}).catch(()=>{});return()=>{mounted=false;};},[]);
  useEffect(() => { if(notice)toast(notice,notice.includes('تعذر')||notice.includes('غير متاح')?'danger':'info'); },[notice,toast]);
  useEffect(() => { document.documentElement.lang = 'ar'; document.documentElement.dir = 'rtl'; try { localStorage.removeItem('bud-lang'); } catch { /* Legacy preferences are optional. */ } }, []);
  useEffect(() => {
    if (!modal || !dialog.current) return;
    const previous = document.activeElement as HTMLElement | null;
    const node = dialog.current;
    const previousOverflow = document.body.style.overflow;
    node.showModal();
    document.body.style.overflow = 'hidden';
    return () => { if (node.open) node.close(); document.body.style.overflow = previousOverflow; previous?.focus(); };
  }, [modal]);
  useEffect(() => {
    const query = new URLSearchParams(); if (page !== 'home') query.set('screen', page); query.set('lang', locale);
    if (page === 'events' && paymentOrder) query.set('order', paymentOrder);
    if (page === 'events' && inspectWhop) query.set('check', 'whop');
    history.replaceState(null, '', `${location.pathname}?${query}`);
  }, [page, locale, paymentOrder, inspectWhop]);
  useEffect(() => { purchaseKey.current = null; setPanel(null); setPaymentHold(false); }, [account.session?.id]);
  const navigate = (next: Page) => { setPanel(null); setNotice(''); setPage(next); requestAnimationFrame(() => main.current?.focus({ preventScroll: true })); };
  const perform = async (action: () => Promise<void>) => {
    if (locked.current) return; locked.current = true; setBusy(true); setNotice('');
    try { await action(); }
    catch (reason) {
      if (reason instanceof HostClientError && reason.status === 401) { void account.refresh(); setNotice(locale === 'ar' ? 'انتهت جلسة الدخول. سجّل دخولك مجددًا.' : 'Your session ended. Please sign in again.'); }
      else setNotice(locale === 'ar' ? 'تعذر إتمام الطلب. حاول مجددًا.' : 'Unable to complete the request. Please try again.');
    } finally { locked.current = false; setBusy(false); }
  };
  const login = () => perform(() => signInHost({page, locale}));
  const buy = () => perform(async () => {
    if (paymentHold || account.dashboard?.paymentReview) return;
    if (!account.session) { await signInHost({page, locale}); return; }
    purchaseKey.current ??= {key:newHostRequestKey(),locale};
    try { await purchaseEvent(purchaseKey.current.key, purchaseKey.current.locale); }
    catch (reason) { if (reason instanceof HostClientError && reason.status === 503 && (reason.code.startsWith('SANDBOX_CHECKOUT_')
      || ['LIVE_CHECKOUT_NOT_CONFIGURED','LIVE_COMMERCE_DISABLED','COMMERCE_MODE_UNAVAILABLE'].includes(reason.code))) { setNotice(t.purchaseUnavailable); return; } throw reason; }
  });
  const closePanel = () => {
    const target = panel !== 'setup' ? '.platform-account-trigger' : '[data-testid=event-setup]';
    setPanel(null); void account.refresh();
    requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(target)?.focus());
  };
  const ongoing = account.dashboard?.events.find(event => !['completed', 'closing'].includes(event.phase) && event.state.phase !== 'closing');
  const modalTitle = modal === 'soon' ? t.soon : modal ? t[modal] : '';

  if(panel==='owner'&&account.session)return <Suspense fallback={<p role="status">جارٍ تحميل لوحة المالك…</p>}><OwnerPanel key={account.session.id} ownerId={account.session.id} ownerName={account.session.displayName} onClose={()=>setPanel('profile')}/></Suspense>;

  return <div className={`platform platform-${page}`} dir={locale === 'ar' ? 'rtl' : 'ltr'} data-testid="platform-root">
    <Seo locale={locale} screen={page} /><a className="skip-link" href="#platform-content">{locale === 'ar' ? 'تجاوز إلى المحتوى' : 'Skip to content'}</a>
    {page === 'home' && !panel && <HeroArtwork />}
    <header className="platform-header" data-node-id="339:2072">
      <div className="platform-header-tools">{account.session ? <AccountMenu session={account.session} locale={locale} credits={account.dashboard?.credits ?? null} busy={busy} onSupport={() => {setPanel(null); setModal('support'); setNotice('');}} onProfile={() => {setPanel('profile');setNotice('');}} onRedeem={() => setRedeemOpen(true)} onHistory={() => {setPanel('history'); setNotice('');}} onLogout={() => void perform(async () => {setPanel(null); setRedeemOpen(false); await account.logout();})} /> : <button type="button" className="platform-login" disabled={busy || account.status === 'loading'} aria-label={locale === 'ar' ? 'سجّل دخولك عبر Discord' : 'Sign in with Discord'} onClick={() => void login()}><img src="/assets/discord-symbol-white.svg" width="24" height="18" alt="" />{t.login}</button>}</div>
      <div className="platform-brand-navigation">
        <nav className="platform-navigation" aria-label={locale === 'ar' ? 'التنقل الرئيسي' : 'Main navigation'}>{(['home', 'events', 'bots', 'designs'] as const).map(item => <button type="button" key={item} data-testid={`nav-${item}`} aria-label={`${t[item]}${item === 'bots' || item === 'designs' ? ` · ${t.soon}` : ''}`} aria-current={page === item ? 'page' : undefined} className={item === 'bots' || item === 'designs' ? 'platform-future-link' : ''} onClick={() => navigate(item)}><span className="platform-nav-icon"><InterfaceIcon kind={item} /></span><span className="platform-nav-label">{t[item]}{(item === 'bots' || item === 'designs') && <small> · {t.soon}</small>}</span></button>)}</nav>
        <button className="platform-brand" aria-label={locale === 'ar' ? 'بُعد — الرئيسية' : 'BU’D — Home'} onClick={() => navigate('home')}><Mark /><span>بُعد</span></button>
      </div>
    </header>
    {notice && <p className="platform-account-notice" role="status">{notice}</p>}
    {page === 'events' && inspectWhop && account.session && <Suspense fallback={<p role="status">{locale === 'ar' ? 'جارٍ تحميل الفحص…' : 'Loading inspection…'}</p>}><WhopPreflight key={account.session.id} locale={locale} onAuthLost={account.expire} /></Suspense>}
    {page === 'events' && paymentOrder && account.session && <PaymentStatus key={account.session.id + paymentOrder} orderId={paymentOrder} locale={locale} onAuthLost={account.expire} onState={onReceiptState} />}
      {account.session&&<Suspense fallback={null}><RedeemDialog key={account.session.id} open={redeemOpen} onClose={()=>setRedeemOpen(false)} onRefresh={()=>void account.refresh()}/></Suspense>}
    <main id="platform-content" className={page === 'home' && !panel ? 'platform-home-main' : 'platform-gallery-main'} ref={main} tabIndex={-1} key={page}>
      {panel === 'profile' && account.session ? <Suspense fallback={<p role="status">جارٍ تحميل البروفايل…</p>}><Profile key={account.session.id} session={account.session} credits={account.dashboard?.credits ?? null} onClose={closePanel} onOwner={() => setPanel('owner')} /></Suspense> : panel === 'history' && account.session ? <Suspense fallback={<p role="status">{locale === 'ar' ? 'جارٍ تحميل السجل…' : 'Loading history…'}</p>}><HostPortal onAuthLost={account.expire} view="history" locale={locale} onExit={closePanel} onPlay={event => onPlay(event, locale)} /></Suspense> : page === 'home' ? <>
        <section className="platform-hero" data-node-id="339:2099"><p className="platform-eyebrow">{t.eyebrow}</p><h1>{t.title}</h1><p className="platform-hero-description">{t.description}</p><div className="platform-hero-actions"><BudMagnetic><button className="platform-action platform-action-primary" data-testid="hero-explore" onClick={() => navigate('events')}>{t.explore}<span aria-hidden="true">←</span></button></BudMagnetic></div><p className="platform-hero-hint">{t.browseHint}</p>{partners.length>0&&<div className="platform-partners-mobile"><BudLogoCarousel logos={partners}/></div>}</section>
        <aside className="platform-proof" aria-label={locale === 'ar' ? 'المجتمع والشركاء' : 'Community and partners'} data-node-id="359:2272"><div className="platform-review-empty"><strong>{t.review}</strong><p>{t.reviewNote}</p></div><div className="platform-partners-empty">{partners.length>0?<><strong>شركاؤنا</strong><BudLogoCarousel logos={partners}/></>:t.partners}</div></aside>
      </> : <>
        <div className="platform-gallery-intro"><h1>{page === 'events' ? t.galleryTitle : t[page]}</h1><p>{page === 'events' ? t.galleryDescription : t.soonDescription}</p>{page === 'events' && <button className="platform-action platform-action-secondary platform-event-how" data-testid="event-how" onClick={() => setModal('how')}>{t.how}</button>}</div>
        {page === 'events' ? <article className="platform-product-card" data-node-id="383:11116"><EventPreview key={locale} locale={locale} /><div className="platform-product-information"><p className="platform-product-eyebrow">{t.productEyebrow}</p><h2>{t.product}</h2><p className="platform-product-description">{t.productDescription}</p><p className="platform-features">{t.features}</p><div className="platform-event-ownership">
          {account.session && (account.keysLoading ? <p role="status">{locale === 'ar' ? 'جارٍ تحميل مفاتيحك…' : 'Loading your keys…'}</p> : account.keysError ? <p>{locale === 'ar' ? 'تعذر تحميل مفاتيحك.' : 'Unable to load your keys.'} <button className="platform-inline-retry" onClick={() => void account.refresh()}>{locale === 'ar' ? 'إعادة المحاولة' : 'Retry'}</button></p> : account.dashboard && <p className="platform-event-keys" data-testid="event-keys">{locale === 'ar' ? <>لديك <bdi>{account.dashboard.credits}</bdi> مفاتيح</> : <>You have <bdi>{account.dashboard.credits}</bdi> keys</>}</p>)}
          <div className="platform-event-actions"><button className="platform-action platform-action-primary" data-testid="product-card-qc" disabled={busy || account.status === 'loading' || paymentHold || account.dashboard?.paymentReview} onClick={() => void buy()}>{t.buy}</button>
          {account.session && account.dashboard && account.dashboard.credits > 0 && !paymentHold && !account.dashboard.paymentReview && <button className="platform-action platform-action-secondary" data-testid="event-setup" disabled={busy} onClick={() => setPanel(panel === 'setup' ? null : 'setup')}>{locale === 'ar' ? 'إعداد الفعالية' : 'Set up event'}</button>}
          {ongoing && <button className="platform-action platform-action-secondary" disabled={busy||ongoing.localMissing} onClick={() => void perform(async () => onPlay(await resumeHostEvent(ongoing.eventId,account.session?.id,account.dashboard?.runtime==='browser-v1'), locale))}>{locale === 'ar' ? 'استكمال الفعالية' : 'Resume event'}</button>}</div>
          {ongoing?.localMissing&&<p className="host-local-policy">تقدم هذه الفعالية غير موجود في هذا المتصفح. <button className="platform-inline-retry" onClick={()=>setPanel('history')}>عرض سجل التشغيل</button></p>}
          </div></div></article> : <article className="platform-product-card platform-coming-soon"><div><p className="platform-status"><BudBadge tone="warning" variant="outline">{t.soon}</BudBadge></p><h2>{t[page]}</h2><p>{t.soonDescription}</p><button className="platform-action platform-action-secondary" onClick={() => setModal('soon')}>{locale === 'ar' ? 'تفاصيل المنتج' : 'Product details'}</button></div></article>}
        {page === 'events' && panel === 'setup' && account.session && <Suspense fallback={<p role="status">{locale === 'ar' ? 'جارٍ التحميل…' : 'Loading…'}</p>}><HostPortal onAuthLost={account.expire} view="setup" locale={locale} onExit={closePanel} onPlay={event => onPlay(event, locale)} /></Suspense>}
      </>}
    </main>
    <footer className="platform-footer"><small>© {locale === 'ar' ? 'بُعد' : 'BU’D'} 2026</small><div className="platform-footer-links">{(['privacy', 'terms', 'support'] as const).map(item => <button key={item} onClick={() => setModal(item)}>{t[item]}</button>)}</div></footer>

    <dialog ref={dialog} className="platform-dialog" data-testid="platform-dialog" aria-labelledby="platform-dialog-title" onKeyDown={event => {
      if (event.key !== 'Tab') return;
      const items = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')];
      const first = items[0], last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }} onCancel={e => { e.preventDefault(); setModal(null); }} onClick={e => { if (e.target !== e.currentTarget) return; const box = e.currentTarget.getBoundingClientRect(); if (e.clientX < box.left || e.clientX > box.right || e.clientY < box.top || e.clientY > box.bottom) setModal(null); }}>
      <div className="platform-dialog-inner"><button className="platform-dialog-close" data-testid="dialog-close" aria-label={t.close} onClick={() => setModal(null)} autoFocus>×</button><h2 id="platform-dialog-title">{modalTitle}</h2>{modal === 'how' ? <><ol className="platform-how-steps">{(locale === 'ar' ? [['اختر فعاليتك', 'تصفّح «سؤال وشرط» وجرّب البطاقتين قبل الشراء.'], ['جهّز الفعالية', 'أدخل الجوائز واضبط المحاولات، وفعّل المؤقت إذا رغبت.'], ['أدرها مع مجتمعك', 'جهّز الجوائز والمؤقت، واحكم على الإجابات وسجّل الفائزين بنفسك.']] : [['Choose your event', 'Explore Question & Condition and try the two cards before buying.'], ['Set up the event', 'Enter prizes, set attempts and optionally enable the timer.'], ['Host for your community', 'Set prizes and a timer, judge answers and record winners yourself.']]).map(([title, description], index) => <li key={title}><bdi>{index + 1}</bdi><div><h3>{title}</h3><p>{description}</p></div></li>)}</ol></> : <p>{modal === 'about' ? t.aboutDescription : modal === 'soon' ? t.soonDescription : t.legalPending}</p>}</div>
    </dialog>
  </div>;
}
