import { useEffect } from 'react';
export function Seo({ locale = 'ar', screen = 'home' }: { locale?: 'ar' | 'en'; screen?: string }) {
  useEffect(() => {
    const isPublic = ['home', 'events', 'bots', 'designs'].includes(screen);
    const origin = 'https://budteam.net';
    const title = 'بُعد — تجارب رقمية بروح مجتمعك';
    const description = 'اكتشف فعاليات بُعد لمجتمعات Discord. جرّب بطاقتي سؤال وشرط وتعرّف إلى طريقة إدارة الفعالية.';
    document.title = title;
    const setMeta = (key: string, value: string, property = false) => { const attr = property ? 'property' : 'name'; let element = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`); if (!element) { element = document.createElement('meta'); element.setAttribute(attr, key); document.head.append(element); } element.content = value; };
    setMeta('description', description); setMeta('robots', isPublic ? 'index,follow' : 'noindex,nofollow');
    setMeta('og:title', title, true); setMeta('og:description', description, true); setMeta('og:type', 'website', true); setMeta('og:locale', 'ar_SA', true);
    setMeta('og:image', `${origin}/assets/home-portal-desktop-v2.png`, true); setMeta('twitter:card', 'summary_large_image');
    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]'); if (!canonical) { canonical = document.createElement('link'); canonical.rel = 'canonical'; document.head.append(canonical); } canonical.href = `${origin}/?${screen === 'home' ? '' : `screen=${encodeURIComponent(screen)}&`}lang=ar`;
    setMeta('og:url', canonical.href, true);
  }, [locale, screen]);
  return null;
}
