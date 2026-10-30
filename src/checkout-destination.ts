/** Accept only a Whop checkout bound to an actual checkout session. Reject direct plan links. */
export function checkoutDestination(value: unknown, environment: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const destination = new URL(value);
    const expectedOrigin = environment === 'production' ? 'https://whop.com'
      : environment === undefined || environment === 'sandbox' ? 'https://sandbox.whop.com' : null;
    const legacySession = /^\/checkout\/ch_[A-Za-z0-9]{5,80}\/?$/.test(destination.pathname) && (!destination.search || (environment==='production' && destination.searchParams.size===1 && /^[a-z0-9_-]{3,40}$/.test(destination.searchParams.get('promoCode')??'')));
    const modernSession = environment === 'production'
      && /^\/checkout\/plan_[A-Za-z0-9]{5,80}\/?$/.test(destination.pathname)
      && (destination.searchParams.size === 1 || (destination.searchParams.size===2 && /^[a-z0-9_-]{3,40}$/.test(destination.searchParams.get('promoCode')??'')))
      && /^ch_[A-Za-z0-9]{5,80}$/.test(destination.searchParams.get('session') ?? '');
    return expectedOrigin && destination.origin === expectedOrigin && !destination.username && !destination.password
      && !destination.hash && (legacySession || modernSession) ? destination.href : null;
  } catch { return null; }
}
