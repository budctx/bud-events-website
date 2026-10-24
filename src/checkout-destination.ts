/** Accept only a session checkout from the same-origin server's declared environment. Never a direct plan URL. */
export function checkoutDestination(value: unknown, environment: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const destination = new URL(value);
    const expectedOrigin = environment === 'production' ? 'https://whop.com'
      : environment === undefined || environment === 'sandbox' ? 'https://sandbox.whop.com' : null;
    return expectedOrigin && destination.origin === expectedOrigin && !destination.username && !destination.password
      && /^\/checkout\/ch_[A-Za-z0-9]+\/?$/.test(destination.pathname) && !destination.search && !destination.hash
      ? destination.href : null;
  } catch { return null; }
}
