/** Keep the official vectors separate from generated art so the mark stays exact. */
export function HeroArtwork() {
  return <div className="platform-art" aria-hidden="true">
    <div className="platform-scene">
      <picture>
        <source media="(max-width:700px)" srcSet="/assets/home-portal-mobile-v2.webp" type="image/webp" />
        <source media="(max-width:700px)" srcSet="/assets/home-portal-mobile-v2.png" type="image/png" />
        <source srcSet="/assets/home-portal-desktop-v2.webp" type="image/webp" />
        <img src="/assets/home-portal-desktop-v2.png" width="1536" height="1024" fetchPriority="high" decoding="async" alt="" />
      </picture>
      <span className="platform-art-logo platform-art-logo-dark" />
      <span className="platform-art-logo platform-art-logo-light" />
    </div>
  </div>;
}
