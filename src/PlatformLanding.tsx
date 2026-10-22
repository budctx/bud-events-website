import { useEffect, useState } from 'react';

type Language = 'ar' | 'en';
type Section = 'home' | 'events' | 'bots' | 'designs';

const content = {
  ar: {
    home: 'الرئيسية', events: 'الفعاليات', bots: 'البوتات', designs: 'التصاميم',
    slogan: 'ننقل تجربتك إلى بُعد آخر',
    eyebrow: 'بُعد · لمجتمعات الدسكورد',
    title: 'منتجات رقمية تنقل مجتمعك إلى بُعد آخر.',
    description: 'نبني تجارب لمجتمعات الدسكورد: فعاليات تفاعلية الآن، وبوتات وتصاميم قادمة. كل منتج له عالمه، وبُعد تجمعهم.',
    discover: 'تصفح أقسام بُعد', try: 'جرّب سؤال وشرط',
    liveLabel: 'منتجات بُعد', available: 'متاحة للتجربة', upcoming: 'قريبًا', made: 'صُنع لمجتمعات الدسكورد',
    pick: 'اختر وجهتك', next: 'التالي', previous: 'السابق',
    homeCard: 'سؤال وشرط', cardQuestion: 'سؤال', cardCondition: 'شرط',
    flipHint: 'اضغط لاكتشاف البطاقة', backHint: 'اضغط لإخفاء البطاقة',
    cardAnswer: 'وش أكثر شيء يحمّس مجتمعك؟',
    eventTitle: 'فعاليتك تبدأ من هنا.',
    eventSub: 'أول تجربة في بُعد: سؤال وشرط. تكشف البطاقات وتدير الجولات والجوائز بنفسك.',
    eventTag: 'فعالية تفاعلية', eventDetail: 'بطاقتان · إجابة صوتية · حكم المضيف',
    botTitle: 'البوتات بتكون جزء من التجربة.',
    botSub: 'ميزة مستقبلية اختيارية. تجربة الفعالية على الويب ما تعتمد على تركيب بوت.',
    botBox: 'تكاملات الدسكورد قيد التطوير',
    designTitle: 'تصاميم تعطي مجتمعك هويته.',
    designSub: 'مساحة مستقبلية لتصاميم المجتمعات والفعاليات، دون وعود بتوفر منتجات لم تُطلق.',
    designBox: 'المجموعة قيد التجهيز',
    note: 'المعاينة تجريبية وبدون اتصال مباشر بالدسكورد أو دفع حقيقي.',
    copyright: 'بُعد — منتجات رقمية للمجتمعات',
    goHome: 'العودة للرئيسية',
    langButton: 'English',
    navTitle: 'أقسام بُعد',
  },
  en: {
    home: 'Home', events: 'Events', bots: 'Bots', designs: 'Designs',
    slogan: 'Take your experience to another dimension.',
    eyebrow: 'BU’D · For Discord communities',
    title: 'Digital products for a new dimension of community.',
    description: 'Building for Discord communities: interactive events today, with bots and design products on the way. Different products, one BU’D.',
    discover: 'Explore BU’D products', try: 'Try Question & Condition',
    liveLabel: 'BU’D products', available: 'Try the preview', upcoming: 'Coming soon', made: 'Made for Discord communities',
    pick: 'Choose where to go', next: 'Next', previous: 'Previous',
    homeCard: 'Question & Condition', cardQuestion: 'Question', cardCondition: 'Condition',
    flipHint: 'Tap to reveal the card', backHint: 'Tap to hide the card',
    cardAnswer: 'What gets your community excited?',
    eventTitle: 'Your event starts here.',
    eventSub: 'The first BU’D experience: Question & Condition. Reveal cards, run rounds and manage prizes.',
    eventTag: 'Interactive event', eventDetail: 'Two cards · Voice answer · Host decision',
    botTitle: 'Bots can be part of the experience.',
    botSub: 'Optional future integration. The web experience will not require a bot.',
    botBox: 'Discord integrations are in development',
    designTitle: 'Designs that feel like your community.',
    designSub: 'A future home for community and event designs. No unlaunched products are shown as available.',
    designBox: 'Collection in preparation',
    note: 'Local preview only: no live Discord connection or real payment.',
    copyright: 'BU’D — Digital products for communities',
    goHome: 'Back to home',
    langButton: 'العربية',
    navTitle: 'BU’D sections',
  }
} as const;

const sections: Section[] = ['home','events','bots','designs'];

function startingLanguage(): Language {
  const p = new URLSearchParams(window.location.search).get('lang');
  if (p === 'ar' || p === 'en') return p;
  try { return window.localStorage.getItem('bud-lang') === 'en' ? 'en' : 'ar'; } catch { return 'ar'; }
}
export default function PlatformLanding() {
  const [lang, setLang] = useState<Language>(startingLanguage);
  const [current, setCurrent] = useState<Section>('home');
  const t = content[lang];
  const index = sections.indexOf(current);
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.dataset.theme = 'light';
    document.title = lang === 'ar' ? 'بُعد — ننقل تجربتك إلى بُعد آخر' : 'BU’D — Another dimension';
    try { window.localStorage.setItem('bud-lang',lang); } catch { /* storage optional */ }
  }, [lang]);
  const selectSection = (s: Section) => {
    setCurrent(s);
  };
  const cta = '/?lang=' + lang;
  return (
    <div className="platform-shell">
      <a className="platform-skip" href="#platform-content">{lang === 'ar' ? 'انتقل للمحتوى' : 'Skip to content'}</a>
      <header className="platform-header">
        <button className="platform-brand" onClick={() => selectSection('home')} aria-label={t.goHome}>
          <img src="/assets/bud-emblem.svg" alt="" width="38" height="30" />
          <span>{lang === 'ar' ? 'بُعد' : 'BU’D'}</span>
        </button>
        <nav className="platform-nav" aria-label={t.navTitle}>
          {(['events','bots','designs'] as Section[]).map(s => (
            <button key={s} type="button" className={current===s?'selected':''}
              aria-current={current===s?'page':undefined} onClick={() => selectSection(s)}>
              {t[s]}
            </button>
          ))}
        </nav>
        <button className="platform-lang" onClick={() => setLang(x => x==='ar'?'en':'ar')} aria-label={lang==='ar'?'Switch to English':'التبديل للعربية'}>
          {t.langButton}
        </button>
      </header>
      <main id="platform-content" className="platform-main" tabIndex={-1} data-section={current}>
        <div className="platform-stage" key={current}>
          {current === 'home' && (
            <section className="platform-hero" aria-labelledby="platform-heading">
              <div className="platform-hero-copy">
                <p className="platform-eyebrow"><span className="platform-dot" />{t.eyebrow}</p>
                <h1 id="platform-heading"><span className="platform-slogan">{t.slogan}</span><span>{t.title}</span></h1>
                <p className="platform-description">{t.description}</p>
                <div className="platform-actions">
                  <button className="platform-action primary"
                    onClick={() => document.querySelector<HTMLElement>('.platform-portal-card')?.focus()}>
                    {t.discover}
                  </button>
                </div>
              </div>
              <div className="platform-art platform-overview" role="group" aria-label={t.liveLabel}>
                <div className="platform-art-note">{t.liveLabel}</div>
                <div className="platform-decor platform-decor-one" aria-hidden="true" />
                <div className="platform-decor platform-decor-two" aria-hidden="true" />
                {(['events','bots','designs'] as const).map((item, i) => (
                  <button type="button" key={item}
                    className={'platform-portal-card platform-portal-'+item}
                    aria-label={lang==='ar' ? 'تصفح '+t[item] : 'Explore '+t[item]}
                    onClick={() => selectSection(item)}>
                    <span className="platform-portal-index" aria-hidden="true">{String(i+1).padStart(2,'0')}</span>
                    <strong>{t[item]}</strong>
                    <small>{item==='events' ? t.available : t.upcoming}</small>
                  </button>
                ))}
              </div>
            </section>
          )}
          {current === 'events' && (
            <section className="platform-feature" aria-labelledby="platform-heading">
              <div className="platform-feature-copy">
                <p className="platform-eyebrow"><span className="platform-dot" />{t.eventTag}</p>
                <h1 id="platform-heading">{t.eventTitle}</h1>
                <p className="platform-description">{t.eventSub}</p>
                <p className="platform-detail">{t.eventDetail}</p>
                <a className="platform-action primary" href={cta}>{t.try}</a>
              </div>
              <div className="platform-product-tile">
                <span className="platform-tile-label">01 / BU’D</span>
                <div className="platform-product-cards" aria-hidden="true">
                  <div className="platform-product-card q"><img src="/assets/bud-emblem.svg" alt="" />{t.cardQuestion}</div>
                  <div className="platform-product-card c"><img src="/assets/bud-emblem.svg" alt="" />{t.cardCondition}</div>
                </div>
                <strong>{t.homeCard}</strong>
              </div>
            </section>
          )}
          {current === 'bots' && (
            <section className="platform-coming" aria-labelledby="platform-heading">
              <p className="platform-eyebrow">{t.upcoming} / BU’D</p>
              <h1 id="platform-heading">{t.botTitle}</h1>
              <p className="platform-description">{t.botSub}</p>
              <div className="platform-coming-chip">{t.botBox}</div>
              <button className="platform-action secondary" onClick={() => selectSection('events')}>{t.discover}</button>
            </section>
          )}
          {current === 'designs' && (
            <section className="platform-coming" aria-labelledby="platform-heading">
              <p className="platform-eyebrow">{t.upcoming} / BU’D</p>
              <h1 id="platform-heading">{t.designTitle}</h1>
              <p className="platform-description">{t.designSub}</p>
              <div className="platform-coming-chip">{t.designBox}</div>
              <button className="platform-action secondary" onClick={() => selectSection('events')}>{t.discover}</button>
            </section>
          )}
        </div>
      </main>
      <footer className="platform-footer">
        <span className="platform-foot-note">{t.copyright}</span>
        <div className="platform-page-nav" aria-label={t.pick}>
          <button onClick={() => selectSection(sections[Math.max(0,index-1)])} disabled={index===0}>{t.previous}</button>
          <span aria-live="polite" dir="ltr">{String(index+1).padStart(2,'0')} / 04</span>
          <button onClick={() => selectSection(sections[Math.min(3,index+1)])} disabled={index===3}>{t.next}</button>
        </div>
        <span className="platform-foot-note">{t.note}</span>
      </footer>
    </div>
  );
}
