import {PublicReviews} from './PublicReviews';
import {initialPromo,promoPrice} from './promo-client';
import type {PublicPrice} from './promo-client';
import './events-fit.css';
import {BudNotice,BudSkeleton} from './BudUI';
import {PolicyCenter} from './PolicyCenter';
import {FooterContent} from './FooterContent';
import {ComicEventTitle} from './ComicEventTitle';
import {PurchaseButton} from './PurchaseButton';
import {readOwnerReturn,clearOwnerReturn} from './owner-return';
import type {OwnerReturn} from './owner-return';
import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import './platform.css';
import { HeroArtwork } from './HeroArtwork';
import { InterfaceIcon } from './InterfaceControls';
import { Seo } from './Seo';
import { AccountMenu } from './AccountMenu';
import { BudBadge, BudLogoCarousel, BudMagnetic, useBudToast } from './BudUI';
import type { PartnerLogo } from './BudUI';
import { useAccount } from './use-account';
import { HostClientError, newHostRequestKey, purchaseEvent, resumeHostEvent, signInHost } from './host-client';
import type { PaymentState } from './payment-state';
import type { HostEvent } from './host-client';
const EventCarousel = lazy(() => import('./EventCarousel'));
const BotCatalog = lazy(() => import('./BotCatalog'));
const EventSetupModal=lazy(()=>import('./EventSetupModal'));
const HostPortal = lazy(() => import('./HostPortal'));
const WhopPreflight = lazy(() => import('./WhopPreflight'));
const RedeemDialog = lazy(() => import('./RedeemDialog'));
const Profile = lazy(() => import('./Profile'));
const OwnerPanel = lazy(() => import('./OwnerPanel'));
const loadEventPreview = () => import('./EventPreview').then(module => ({default:module.EventPreview}));
const EventPreview = lazy(loadEventPreview);
const PaymentStatus = lazy(() => import('./PaymentStatus'));

type Locale = 'ar' | 'en';
type Page = 'home' | 'events' | 'bots' | 'designs' | 'policies';
type Modal = 'soon' | 'about' | 'privacy' | 'terms' | 'support' | 'how' | null;
type PlatformProps = { onPlay: (event: HostEvent, locale: Locale) => void };

const copy = {
  ar: { policies:'مركز المساعدة والسياسات', home: 'الرئيسية', events: 'الفعاليات', bots: 'بوتات', designs: 'تصاميم', soon: 'قريبًا', login: 'سجّل دخولك', eyebrow: 'تجارب رقمية، بروح مجتمعك', title: <>ننقل تجربتك<br />إلى بُعد آخر</>, description: <>منتجات رقمية لمجتمعك على Discord.<br />ابدأ بالفعاليات، واكتشف ما يأتي بعدها.</>, explore: 'اختر فعاليتك', about: 'عن بُعد', how: 'كيف ابدأ؟', browseHint: 'تصفّح المنتجات وجرّب الفعالية قبل الشراء.', privacy: 'الخصوصية', terms: 'الشروط', support: 'الدعم', close: 'إغلاق', galleryTitle: 'فعاليات بُعد', galleryDescription: 'اختر الفعالية، وجهّز وقتًا يجمع مجتمعك.', product: 'سؤال وشرط', productEyebrow: 'فعالية صوتية على Discord', productDescription: <>سؤال يختبرك، وشرط يغيّر التحدّي.<br />أدر الفعالية بطريقتك مع مجتمعك.</>, features: 'إدارة للهوست · جوائز · مؤقت اختياري', view: 'عرض الفعالية', review: 'آراء المجتمع قريبًا', reviewNote: 'لم تُنشر آراء معتمدة بعد.', partners: 'الشركاء قريبًا', purchaseUnavailable: 'الشراء غير متاح حاليًا. لن يُخصم أي رصيد.', rehearsal: 'معاينة ببطاقتين ثابتتين ومؤقت 5 ثوانٍ، دون تشغيل فعالية كاملة.', details: 'اكشف بطاقتي السؤال والشرط، واحكم على الإجابة صوتيًا. بعد الإجابة الصحيحة أدخل اسم الفائز، ثم وزّع الجوائز واختتم الفعالية.', soonDescription: 'نعمل على منتجات جديدة لمجتمعك. ستظهر هنا عند توفرها.', aboutDescription: 'بُعد منصة منتجات رقمية لمجتمعات Discord. ننقل تجربتك إلى بُعد آخر.', legalPending: 'هذه الصفحة قيد الإعداد. ستتوفر التفاصيل المعتمدة قبل تفعيل الشراء.', loginUnavailable: 'تسجيل الدخول والشراء غير متاحين في هذه المعاينة. يمكنك تصفّح المنتجات وتجربة البطاقتين دون تسجيل.', changeLanguage: 'English', question: 'سؤال', condition: 'شرط' }

};

function Mark({ className = '' }: { className?: string }) {
  return <span className={`platform-mark ${className}`} aria-hidden="true"><img src="/assets/bud-emblem.svg" alt="" width="32" height="23" /></span>;
}

function pageFromURL(): Page {
  const screen = new URLSearchParams(location.search).get('screen');
  return screen === 'policies' || screen === 'bots' || screen === 'designs' ? screen : ['events', 'host', 'game','local'].includes(screen ?? '') ? 'events' : 'home';
}
function panelFromURL(): 'history' | 'setup' | 'profile' | 'owner' | null {
  const value = new URLSearchParams(location.search).get('panel');
  // The owner dashboard is an authenticated transient view: a hard reload returns to the public site.
  return value === 'history' || value === 'setup' || value === 'profile' ? value : null;
}
export default function Platform({ onPlay }: PlatformProps) {
  const locale: Locale = 'ar';
  useLayoutEffect(()=>{
    const root=document.documentElement;
    const update=()=>{const value=Math.max(0,(innerWidth-document.body.clientWidth)/2)+'px';if(root.style.getPropertyValue('--platform-scrollbar-edge')!==value)root.style.setProperty('--platform-scrollbar-edge',value);};
    update();const observer=new ResizeObserver(update);observer.observe(document.body);window.addEventListener('resize',update);
    return()=>{observer.disconnect();window.removeEventListener('resize',update);root.style.removeProperty('--platform-scrollbar-edge');};
  },[]);
  const [page, setPage] = useState<Page>(pageFromURL);
  const [modal, setModal] = useState<Modal>(null);
  const [busy, setBusy] = useState(false);
  const [activeAction,setActiveAction] = useState<'login' | 'purchase' | null>(null);
  const [panel, setPanel] = useState<'history' | 'setup' | 'profile' | 'owner' | null>(panelFromURL);
  const account = useAccount();
  const toast = useBudToast();
  const notifyError=(text:string)=>toast(text,'danger');
  const [ownerReturn,setOwnerReturn]=useState<OwnerReturn|null>(null);
  useEffect(()=>{if(!account.session)return;const saved=readOwnerReturn();if(!saved)return;clearOwnerReturn();if(saved.ownerId===account.session.id){setOwnerReturn(saved);setPanel('owner');}},[account.session?.id]);
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
  const [promoCode]=useState(initialPromo);
  const [price,setPrice]=useState<PublicPrice|null>(null),[promoLoading,setPromoLoading]=useState(true),[promoError,setPromoError]=useState('');
  useEffect(()=>{const controller=new AbortController();setPromoLoading(true);
    void promoPrice(promoCode,controller.signal).then(setPrice).catch(()=>{if(!controller.signal.aborted)setPromoError(promoCode?'الكوبون غير متاح حاليًا. لم يُطبّق أي خصم.':'تعذر تحميل السعر. حدّث الصفحة وحاول مجددًا.');}).finally(()=>{if(!controller.signal.aborted)setPromoLoading(false);});
    return()=>controller.abort();
  },[promoCode]);
  const purchaseKey = useRef<{key:string;locale:Locale} | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const t = copy.ar;
  const main = useRef<HTMLElement>(null);

  useEffect(() => {
    if (page !== 'home') return;
    const controller = new AbortController(); let mounted = true;
    const load = () => { void import('./partners-client').then(module => module.getPublicPartners(controller.signal)).then(result => { if (mounted && !controller.signal.aborted) setPartners(result); }).catch(() => {}); };
    let idle: number | undefined, timeout: number | undefined;
    if ('requestIdleCallback' in window) idle = window.requestIdleCallback(load, {timeout:1500});
    else timeout = setTimeout(load, 300);
    return () => { mounted = false; controller.abort(); if (idle !== undefined) window.cancelIdleCallback(idle); if (timeout !== undefined) clearTimeout(timeout); };
  },[page]);
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
  const routeUrl = (nextPage: Page, nextPanel: typeof panel = null) => {
    const query = new URLSearchParams();
    if (nextPage !== 'home') query.set('screen', nextPage);
    query.set('lang', locale);
    if (nextPage === 'events' && paymentOrder) query.set('order', paymentOrder);
    if (nextPage === 'events' && inspectWhop) query.set('check', 'whop');
    if (nextPanel) query.set('panel', nextPanel);
    return `${location.pathname}?${query}${nextPage==='policies'?location.hash:''}`;
  };
  // Normalize deep links without adding an unwanted history entry; user navigation pushes entries.
  useEffect(() => {
    const expected = routeUrl(page,panel);
    if (`${location.pathname}${location.search}` !== expected) history.replaceState(null,'',expected);
  }, [page,panel,locale,paymentOrder,inspectWhop]);
  useEffect(() => {
    const onBackOrForward = () => {
      setPage(pageFromURL());
      setPanel(panelFromURL());
      setModal(null);

    };
    window.addEventListener('popstate',onBackOrForward);
    return () => window.removeEventListener('popstate',onBackOrForward);
  }, []);
  const previousAccountId = useRef<string|null>(null);
  useEffect(() => {
    const next = account.session?.id ?? null;
    // Preserve a direct setup/profile URL during initial Discord session hydration.
    if (previousAccountId.current !== null && previousAccountId.current !== next) setPanel(null);
    previousAccountId.current = next;
    purchaseKey.current = null;
    setPaymentHold(false);
  }, [account.session?.id]);
  const navigate = (next: Page) => {
    if (page === next && !panel) return;
    history.pushState(null,'',routeUrl(next));
    setPanel(null); setPage(next);
    // The main node persists across sections. Focus now so a later frame cannot
    // steal focus after the user has already pressed Tab on the new section.
    main.current?.focus({ preventScroll: true });
  };
  const openPanel = (next: 'history' | 'setup' | 'profile' | 'owner') => {
    if (panel === next) return;
    history.pushState(null,'',routeUrl(page,next));
    setPanel(next);
  };
  const perform = async (action: () => Promise<void>, kind: 'login' | 'purchase' | null = null) => {
    if (locked.current) return; locked.current = true; setBusy(true); setActiveAction(kind);
    const progress=kind?toast(kind==='login'?'جارٍ تجهيز تسجيل الدخول عبر Discord…':'جارٍ التحقق من طلب الشراء…','info',{persistent:true}):null;
    try { await action(); }
    catch (reason) {
      if (reason instanceof HostClientError && reason.status === 401) { void account.refresh(); notifyError(locale === 'ar' ? 'انتهت جلسة الدخول. سجّل دخولك مجددًا.' : 'Your session ended. Please sign in again.'); }
      else notifyError(locale === 'ar' ? 'تعذر إتمام الطلب. حاول مجددًا.' : 'Unable to complete the request. Please try again.');
    } finally { if(progress)toast.dismiss(progress);locked.current = false; setBusy(false); setActiveAction(null); }
  };
  const login = () => perform(async () => {
    const snapshot = account.status === 'loading' ? await account.whenReady() : {session:account.session,dashboard:account.dashboard};
    if (!snapshot.session) await signInHost({page:page==='policies'?'home':page, locale});
  },'login');
  const buy = () => perform(async () => {
    const snapshot = account.status === 'loading' ? await account.whenReady() : {session:account.session,dashboard:account.dashboard};
    if (paymentHold || snapshot.dashboard?.paymentReview) return;
    if (!snapshot.session) { await signInHost({page:page==='policies'?'home':page, locale}); return; }
    purchaseKey.current ??= {key:newHostRequestKey(),locale};
    try { await purchaseEvent(purchaseKey.current.key, purchaseKey.current.locale,price?.promotion?.code); }
    catch (reason) { if (reason instanceof HostClientError && reason.status === 503 && (reason.code.startsWith('SANDBOX_CHECKOUT_')
      || ['LIVE_CHECKOUT_NOT_CONFIGURED','LIVE_COMMERCE_DISABLED','COMMERCE_MODE_UNAVAILABLE'].includes(reason.code))) { notifyError(t.purchaseUnavailable); return; } throw reason; }
  },'purchase');
  const closePanel = () => {
    const target = panel !== 'setup' ? '.platform-account-trigger' : '[data-testid=event-setup]';
    setPanel(null);
    if (new URLSearchParams(location.search).has('panel')) history.replaceState(null,'',routeUrl(page));
    void account.refresh();
    requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(target)?.focus());
  };
  const ongoing = account.dashboard?.events.find(event => !['completed', 'closing'].includes(event.phase) && event.state.phase !== 'closing');
  const modalTitle = modal === 'soon' ? t.soon : modal ? t[modal] : '';
  const canSetup = !!account.session && !!account.dashboard && account.dashboard.credits > 0 && !paymentHold && !account.dashboard.paymentReview;
  const canResume = !!ongoing && !ongoing.localMissing && !!account.session;

  if(panel==='owner'&&account.session)return <Suspense fallback={<BudSkeleton label="جارٍ تحميل لوحة المالك…"/>}><OwnerPanel key={account.session.id} ownerId={account.session.id} ownerName={account.session.displayName} initialReturn={ownerReturn} onClose={()=>{setOwnerReturn(null);setPanel('profile');}}/></Suspense>;

  return <div className={`platform platform-${page}${page==='events'&&(!panel||panel==='setup')?' platform-events-fit':''}`} dir={locale === 'ar' ? 'rtl' : 'ltr'} data-testid="platform-root">
    <Seo locale={locale} screen={page} /><a className="skip-link" href="#platform-content">{locale === 'ar' ? 'تجاوز إلى المحتوى' : 'Skip to content'}</a>
    {page === 'home' && !panel && <HeroArtwork />}
    <header className="platform-header" data-node-id="339:2072">
      <div className="platform-header-tools">{account.session ? <AccountMenu session={account.session} locale={locale} credits={account.dashboard?.credits ?? null} busy={busy} onSupport={() => {setPanel(null); history.pushState(null,'',`${location.pathname}?screen=policies&lang=ar#support`);setPage('policies');window.dispatchEvent(new HashChangeEvent('hashchange')); }} onProfile={() => openPanel('profile')} onRedeem={() => setRedeemOpen(true)} onHistory={() => openPanel('history')} onLogout={() => void perform(async () => {setPanel(null); setRedeemOpen(false); await account.logout();toast('تم تسجيل الخروج.','success');})} /> : <button type="button" className="platform-login" disabled={busy} aria-busy={activeAction==='login'} aria-label={locale === 'ar' ? 'سجّل دخولك عبر Discord' : 'Sign in with Discord'} onClick={() => void login()}><img src="/assets/discord-symbol-white.svg" width="24" height="18" alt="" />{activeAction==='login'?'جارٍ فتح Discord…':t.login}</button>}</div>
      <div className="platform-brand-navigation">
        <nav className="platform-navigation" aria-label={locale === 'ar' ? 'التنقل الرئيسي' : 'Main navigation'}>{(['home', 'events', 'bots', 'designs'] as const).map(item => <button type="button" key={item} data-testid={`nav-${item}`} aria-label={`${t[item]}${item === 'bots' || item === 'designs' ? ` · ${t.soon}` : ''}`} aria-current={page === item ? 'page' : undefined} className={item === 'bots' || item === 'designs' ? 'platform-future-link' : ''} onPointerEnter={item === 'events' ? () => { void loadEventPreview(); } : undefined} onFocus={item === 'events' ? () => { void loadEventPreview(); } : undefined} onClick={() => navigate(item)}><span className="platform-nav-icon"><InterfaceIcon kind={item} /></span><span className="platform-nav-label">{t[item]}{(item === 'bots' || item === 'designs') && <small> · {t.soon}</small>}</span></button>)}</nav>
        <button className="platform-brand" aria-label={locale === 'ar' ? 'بُعد — الرئيسية' : 'BU’D — Home'} onClick={() => navigate('home')}><Mark /><span>بُعد</span></button>
      </div>
    </header>
    {page === 'events' && inspectWhop && account.session && <Suspense fallback={<BudSkeleton label="جارٍ تحميل الفحص…"/>}><WhopPreflight key={account.session.id} locale={locale} onAuthLost={account.expire} /></Suspense>}
    {paymentOrder && account.session && <Suspense fallback={null}><PaymentStatus key={account.session.id + paymentOrder} orderId={paymentOrder} locale={locale} onAuthLost={account.expire} onState={onReceiptState} /></Suspense>}
      {account.session&&<Suspense fallback={null}><RedeemDialog key={account.session.id} open={redeemOpen} onClose={()=>setRedeemOpen(false)} onRefresh={()=>void account.refresh()}/></Suspense>}
    <main id="platform-content" className={page === 'home' && !panel ? 'platform-home-main' : 'platform-gallery-main'} ref={main} tabIndex={-1} key={page}>
      {page === 'policies' ? <PolicyCenter/> : panel === 'profile' && account.session ? <Suspense fallback={<BudSkeleton label="جارٍ تحميل البروفايل…"/>}><Profile key={account.session.id} session={account.session} credits={account.dashboard?.credits ?? null} onClose={closePanel} onOwner={() => openPanel('owner')} /></Suspense> : panel === 'history' && account.session ? <Suspense fallback={<BudSkeleton label="جارٍ تحميل السجل…"/>}><HostPortal onAuthLost={account.expire} view="history" locale={locale} onExit={closePanel} onPlay={event => onPlay(event, locale)} /></Suspense> : page === 'home' ? <>
        <section className="platform-hero" data-node-id="339:2099"><p className="platform-eyebrow">{t.eyebrow}</p><h1>{t.title}</h1><p className="platform-hero-description">{t.description}</p><div className="platform-hero-actions"><BudMagnetic><button className="platform-action platform-action-primary" data-testid="hero-explore" onPointerEnter={() => { void loadEventPreview(); }} onFocus={() => { void loadEventPreview(); }} onClick={() => navigate('events')}>{t.explore}<span aria-hidden="true">←</span></button></BudMagnetic></div><p className="platform-hero-hint">{t.browseHint}</p>{partners.length>0&&<div className="platform-partners-mobile"><BudLogoCarousel logos={partners}/></div>}</section>
        <aside className="platform-proof" aria-label={locale === 'ar' ? 'المجتمع والشركاء' : 'Community and partners'} data-node-id="359:2272"><PublicReviews/><div className="platform-partners-empty">{partners.length>0?<><strong>شركاؤنا</strong><BudLogoCarousel logos={partners}/></>:t.partners}</div></aside>
      </> : <>
        <div className="platform-gallery-intro"><h1>{page === 'events' ? t.galleryTitle : t[page]}</h1><p>{page === 'events' ? t.galleryDescription : t.soonDescription}</p>{page === 'events' && <button className="platform-action platform-action-secondary platform-event-how" data-testid="event-how" onClick={() => setModal('how')}>{t.how}</button>}</div>
        {page === 'events' ? <Suspense fallback={<BudSkeleton label="جارٍ تحميل الفعاليات…"/>}><EventCarousel><article className="platform-product-card" data-node-id="383:11116"><Suspense fallback={<div className="event-preview" role="status" aria-label="جارٍ تحميل معاينة الفعالية…" />}><EventPreview key={locale} locale={locale} /></Suspense><div className="platform-product-information"><p className="platform-product-eyebrow">{t.productEyebrow}</p><h2><ComicEventTitle>{t.product}</ComicEventTitle></h2><p className="platform-product-description">{t.productDescription}</p><p className="platform-features">{t.features}</p><div className="platform-event-ownership">
          {account.session && (account.keysLoading ? <BudSkeleton label="جارٍ تحميل مفاتيحك…" lines={1}/> : account.keysError ? <div><BudNotice tone="danger">تعذر تحميل مفاتيحك.</BudNotice><button className="platform-inline-retry" onClick={() => void account.refresh()}>{locale === 'ar' ? 'إعادة المحاولة' : 'Retry'}</button></div> : account.dashboard && <p className="platform-event-keys" data-testid="event-keys">{locale === 'ar' ? <>لديك <bdi>{account.dashboard.credits}</bdi> مفاتيح</> : <>You have <bdi>{account.dashboard.credits}</bdi> keys</>}</p>)}
          <div className="platform-event-actions">
          {canResume && <button className="platform-action platform-action-primary" data-testid="event-resume" disabled={busy} onClick={() => void perform(async () => onPlay(await resumeHostEvent(ongoing!.eventId,account.session?.id,account.dashboard?.runtime==='browser-v1'), locale))}>عودة للفعالية</button>}
          {canSetup && <button aria-haspopup="dialog" aria-expanded={panel==='setup'} className={`platform-action ${canResume?'platform-action-secondary':'platform-action-primary'}`} data-testid="event-setup" disabled={busy} onClick={() => panel === 'setup' ? closePanel() : openPanel('setup')}>بدء فعالية</button>}
          <PurchaseButton amountMinor={price?.amountMinor??0} originalAmountMinor={price?.promotion?price.baseAmountMinor:undefined} secondary={canSetup||canResume} data-testid="product-card-qc" disabled={busy || promoLoading || !!promoError || paymentHold || account.dashboard?.paymentReview} loading={activeAction==='purchase'} priceLoading={!price} onClick={() => void buy()}/>
          {price?.promotion&&<small className="bud-promo-applied" role="status">✓ تم تطبيق كوبون <bdi>{price.promotion.code}</bdi> — خصم {price.promotion.percent}%</small>}
          {promoLoading&&<small role="status">جارٍ تحميل السعر…</small>}
          {promoError&&<small role="alert">{promoError} <button type="button" onClick={()=>{try{sessionStorage.removeItem('bud-promo-code');}catch{}const url=new URL(location.href);url.searchParams.delete('promoCode');url.searchParams.delete('coupon');location.assign(url.href);}}>المتابعة بدون كوبون</button></small>}

          </div>
          {ongoing?.localMissing&&<BudNotice tone="warning" persistent>تقدم هذه الفعالية غير موجود في هذا المتصفح.</BudNotice>}
          </div></div></article></EventCarousel></Suspense> : page==='bots'?<Suspense fallback={<BudSkeleton label="جارٍ تحميل البوتات…"/>}><BotCatalog/></Suspense>:<article className="platform-product-card platform-coming-soon"><div><p className="platform-status"><BudBadge tone="warning" variant="outline">{t.soon}</BudBadge></p><h2>{t[page]}</h2><p>{t.soonDescription}</p><button className="platform-action platform-action-secondary" onClick={() => setModal('soon')}>{locale === 'ar' ? 'تفاصيل المنتج' : 'Product details'}</button></div></article>}
      </>}
    </main>
    {page==='events'&&panel==='setup'&&account.session&&<Suspense fallback={<BudSkeleton label="جارٍ فتح إعداد الفعالية…"/>}><EventSetupModal key={account.session.id} locale={locale} onAuthLost={account.expire} onClose={closePanel} onPlay={event=>onPlay(event,locale)}/></Suspense>}
    <footer className="platform-footer"><small>© {locale === 'ar' ? 'بُعد' : 'BU’D'} 2026</small><div className="platform-footer-links">{(['privacy', 'terms', 'support'] as const).map(item => <button key={item} onClick={() => {setPanel(null);history.pushState(null,'',`${location.pathname}?screen=policies&lang=ar#${item}`);setPage('policies');window.dispatchEvent(new HashChangeEvent('hashchange'));}}>{t[item]}</button>)}</div></footer>

    <dialog ref={dialog} className="platform-dialog" data-testid="platform-dialog" aria-labelledby="platform-dialog-title" onKeyDown={event => {
      if (event.key !== 'Tab') return;
      const items = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')];
      const first = items[0], last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }} onCancel={e => { e.preventDefault(); setModal(null); }} onClick={e => { if (e.target !== e.currentTarget) return; const box = e.currentTarget.getBoundingClientRect(); if (e.clientX < box.left || e.clientX > box.right || e.clientY < box.top || e.clientY > box.bottom) setModal(null); }}>
      <div className="platform-dialog-inner"><button className="platform-dialog-close" data-testid="dialog-close" aria-label={t.close} onClick={() => setModal(null)} autoFocus>×</button><h2 id="platform-dialog-title">{modalTitle}</h2>{modal === 'how' ? <><ol className="platform-how-steps">{(locale === 'ar' ? [['اختر فعاليتك', 'تصفّح «سؤال وشرط» وجرّب البطاقتين قبل الشراء.'], ['جهّز الفعالية', 'أدخل الجوائز، وفعّل المؤقت إذا رغبت.'], ['أدرها مع مجتمعك', 'جهّز الجوائز والمؤقت، واحكم على الإجابات وسجّل الفائزين بنفسك.']] : [['Choose your event', 'Explore Question & Condition and try the two cards before buying.'], ['Set up the event', 'Enter prizes and optionally enable the timer.'], ['Host for your community', 'Set prizes and a timer, judge answers and record winners yourself.']]).map(([title, description], index) => <li key={title}><bdi>{index + 1}</bdi><div><h3>{title}</h3><p>{description}</p></div></li>)}</ol></> : modal === 'privacy' || modal === 'terms' || modal === 'support' ? <FooterContent page={modal}/> : <p>{modal === 'about' ? t.aboutDescription : modal === 'soon' ? t.soonDescription : t.legalPending}</p>}</div>
    </dialog>
  </div>;
}
