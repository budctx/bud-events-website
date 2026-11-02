import {publicPaths} from './routes';
import { useEffect } from 'react';
export function Seo({ locale = 'ar', screen = 'home' }: { locale?: 'ar' | 'en'; screen?: string }) {
  useEffect(() => {
    const isPublic = ['home', 'events', 'bots', 'designs'].includes(screen);
    const origin = 'https://budteam.net';
    const title = screen === 'review' ? 'التقييمات | بُعد' : 'بُعد';
    const description = screen === 'review' ? 'رأيك يهمنا ويساعدنا نطوّر تجربتك.' : 'ننقل تجربتك إلى بُعد آخر — فعاليات وبوتات وتصاميم لمجتمعات Discord.';
    document.title = title;
    const setMeta = (key: string, value: string, property = false) => { const attr = property ? 'property' : 'name'; let element = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`); if (!element) { element = document.createElement('meta'); element.setAttribute(attr, key); document.head.append(element); } element.content = value; };
    setMeta('description', description); setMeta('robots', isPublic ? 'index,follow' : 'noindex,nofollow');
    setMeta('og:title', title, true); setMeta('og:description', description, true); setMeta('og:type', 'website', true); setMeta('og:locale', 'ar_SA', true);
    const image = screen === 'review' ? `${origin}/assets/%D8%A7%D9%84%D8%AA%D9%82%D9%8A%D9%8A%D9%85%D8%A7%D8%AA.png` : `${origin}/assets/bud-share-v2.png`;
    setMeta('og:image', image, true); setMeta('og:image:secure_url', image, true); setMeta('og:image:width', screen === 'review' ? '1920' : '1920', true); setMeta('og:image:height', screen === 'review' ? '700' : '1080', true); setMeta('twitter:image', image); setMeta('twitter:title', title); setMeta('twitter:description', description); setMeta('twitter:card', 'summary_large_image');
    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]'); if (!canonical) { canonical = document.createElement('link'); canonical.rel = 'canonical'; document.head.append(canonical); } canonical.href = origin + (publicPaths[screen as keyof typeof publicPaths] ?? '/');
    setMeta('og:url', canonical.href, true);
  }, [locale, screen]);
  return null;
}
