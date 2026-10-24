import { test, expect } from '@playwright/test';
import { manualGameReducer } from '../../src/manual-game';
import type { ManualState } from '../../src/manual-game';
const initialState = { phase: 'live', config: { duration: 5, timerEnabled: false, attempts: 1 }, prizes: [{ id: 'prize-1', name: 'قسيمة', revealed: false, winnerId: null }], winners: [], nextWinnerNumber: 1, question: false, condition: false, attempt: 1, round: 0, deadline: null, remaining: 5, pendingWinner: false };
const active = { eventId: 'event-1', title: 'لقاء المجتمع', phase: 'active', version: 1, state: initialState };
const dashboard = { credits: 2, events: [active], products: [{ id: 'question-condition', name: 'سؤال وشرط', available: true, slotCost: 1 }], contentVersions: [{ id: 'qc-v1', questionCount: 6, conditionCount: 6 }] };
const ok = (data: unknown) => ({ status: 200, json: { code: 'OK', data } });
async function session(page: import('@playwright/test').Page) { await page.route('**/api/auth?action=session', route => route.fulfill(ok({ id: 'host-1', displayName: 'مقدم المجتمع', avatarUrl: 'https://cdn.discordapp.com/avatars/123/abc.png' }))); }
test('legacy host URL remains the contextual events gallery without a standalone workspace', async ({ page }) => {
  await page.route('**/api/auth?action=session', route => route.fulfill({ status: 401, json: { code: 'AUTH_REQUIRED' } }));
  await page.goto('/?screen=host&lang=ar');
  await expect(page.getByRole('heading', { name: 'فعاليات بُعد' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'بدء الفعالية', exact: true })).toHaveCount(0);
  await expect(page.getByTestId('product-card-qc')).toHaveText('اشترِ الآن — ٢ ر.س');
  await expect(page).toHaveURL(/screen=events/);
});
async function openHistory(page: import('@playwright/test').Page) {
  const account = page.locator('.platform-account-trigger');
  await account.focus(); await page.keyboard.press('ArrowDown');
  await page.getByRole('menuitem', { name: 'السجل', exact: true }).click();
  await expect(page.locator('.host-embedded')).toBeVisible();
}

test('host start retries preserve the same idempotency key and payload', async ({ page }) => {
  await session(page);
  const starts: Record<string, unknown>[] = [];
  await page.route('**/api/host', route => {
    const payload = route.request().postDataJSON();
    if (payload.action === 'dashboard') return route.fulfill(ok({ ...dashboard, events: [] }));
    starts.push(payload);
    if (starts.length === 1) return route.abort('connectionfailed');
    return route.fulfill(ok(active));
  });
  await page.goto('/?screen=host&lang=ar');
  await expect(page.getByTestId('event-keys')).toContainText('2');
  await page.getByTestId('event-setup').click();
  await page.getByLabel('اسم الفعالية').fill('جلسة مميزة');
  await page.getByLabel('الجوائز', { exact: true }).fill('قسيمة\nقسيمة');
  await page.getByRole('button', { name: 'بدء الفعالية', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByLabel('اسم الفعالية')).toBeDisabled();
  await page.locator('.host-embedded').getByRole('button', { name: 'إعادة المحاولة', exact: true }).click();
  await expect.poll(() => starts.length).toBe(2);
  expect(starts[0]).toEqual(starts[1]);
  expect(starts[0].idempotencyKey).toMatch(/^[a-f0-9-]{36}$/);
  expect(starts[0].prizeText).toBe('قسيمة\nقسيمة');
});
test('host history summary is read only and fits a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await session(page);
  const requests: string[] = [];
  await page.route('**/api/host', route => {
    const payload = route.request().postDataJSON(); requests.push(payload.action);
    return route.fulfill(ok({ ...dashboard, credits: 0, events: [{ ...active, phase: 'completed', state: { ...initialState, phase: 'closing', winners: [{ id: 'winner-1', name: 'سارة' }], prizes: [{ id: 'prize-1', name: 'قسيمة', revealed: true, winnerId: 'winner-1' }] } }] }));
  });
  await page.goto('/?screen=host&lang=ar');
  await openHistory(page);
  await expect(page.getByRole('button', { name: 'بدء الفعالية', exact: true })).toHaveCount(0);
  await expect(page.locator('.host-balance')).toHaveCount(0);
  await page.getByRole('button', { name: 'عرض الملخص' }).click();
  await expect(page.getByRole('dialog')).toContainText('سارة');
  expect(requests.every(action => action === 'dashboard')).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});

test('logout clears cached host data when upstream revocation is unavailable',async({page})=>{
  await session(page);
  await page.route('**/api/host',route=>route.fulfill(ok(dashboard)));
  await page.route('**/api/auth?action=logout',route=>route.fulfill({status:503,json:{code:'AUTH_REVOCATION_UNAVAILABLE'}}));
  await page.goto('/?screen=host&lang=ar');
  await openHistory(page);
  await page.locator('.platform-account-trigger').focus(); await page.keyboard.press('ArrowDown');
  await page.getByRole('menuitem',{name:'تسجيل الخروج',exact:true}).click();
  await expect(page.getByRole('button',{name:'سجّل دخولك عبر Discord',exact:true})).toBeVisible();
  await expect(page.getByTestId('event-keys')).toHaveCount(0);
  await expect(page.locator('.host-embedded')).toHaveCount(0);
  await expect(page.getByText('مقدم المجتمع',{exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'استكمال الفعالية',exact:true})).toHaveCount(0);
});

test('persisted host game recovers an acknowledged reveal after a lost response', async ({ page }, info) => {
  await session(page);
  let current = { ...active, state: structuredClone(initialState) as ManualState, cards: { question: 'دولة', condition: 'تبدأ بحرف س' }, serverNow: Date.now() };
  const receipts = new Map<string, typeof current>();
  const requests: Record<string, any>[] = [];
  let loseFirstResponse = true;
  await page.route('**/api/host', async route => {
    const payload = route.request().postDataJSON();
    if (payload.action === 'dashboard') return route.fulfill(ok({ ...dashboard, events: [current] }));
    if (payload.action === 'resume') return route.fulfill(ok(current));
    requests.push(payload);
    const prior = receipts.get(payload.idempotencyKey);
    if (prior) return route.fulfill(ok(prior));
    current = { ...current, version: current.version + 1, state: manualGameReducer(current.state, payload.command), serverNow: Date.now() };
    receipts.set(payload.idempotencyKey,current);
    if (loseFirstResponse) { loseFirstResponse = false; return route.abort('connectionfailed'); }
    return route.fulfill(ok(current));
  });
  await page.goto('/?screen=host&lang=ar');
  await expect(page.getByRole('button',{name:'استكمال الفعالية',exact:true})).toBeVisible();
  await page.getByTestId('event-setup').click();
  await expect(page.getByRole('button',{name:'بدء الفعالية',exact:true})).toHaveCSS('background-color','rgb(255, 182, 56)');
  await expect(page.getByRole('button',{name:'توضيح الجوائز',exact:true})).toHaveCSS('border-top-width','0px');
  await page.evaluate(()=>document.fonts.ready);
  for (const width of [1440,390]) { await page.setViewportSize({width,height:844}); await page.screenshot({path:info.outputPath(`host-dashboard-${width}.png`),fullPage:true,animations:'disabled'}); expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true); }
  await page.getByRole('button',{name:'استكمال الفعالية',exact:true}).click();
  await page.getByRole('button',{name:'اكشف سؤال',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('تعذر تأكيد');
  await expect(page.getByRole('button',{name:'اكشف شرط',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'إعادة المحاولة',exact:true}).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'اكشف شرط',exact:true})).toBeEnabled();
  expect(requests[0]).toEqual(requests[1]); expect(current.version).toBe(2);
  await page.getByRole('button',{name:'اكشف شرط',exact:true}).click();
  await page.getByRole('button',{name:'صحيحة',exact:true}).click();
  await page.getByLabel('اسم الفائز',{exact:true}).fill('سارة');
  await page.getByRole('button',{name:'إضافة الفائز',exact:true}).click();
  await expect(page.locator('#mg-winner-name')).not.toBeVisible();
  expect(current.state.winners).toEqual([{id:'winner-1',name:'سارة'}]);
  expect(requests.at(-1)?.version).toBe(4);
  await expect(page.locator('.mg-disclosure')).toContainText('فعالية محفوظة');
  await page.screenshot({path:info.outputPath('host-game-saved-390.png'),fullPage:true,animations:'disabled'});
});

for (const locale of ['ar', 'en'] as const) test(`sign-in preserves all gallery contexts ${locale}`, async ({ page }) => {
  await page.route('**/api/auth?action=session', route => route.fulfill({ status: 401, json: { code: 'DISCORD_AUTH_REQUIRED' } }));
  const payloads: unknown[] = [];
  await page.route('**/api/auth?action=signin', route => { payloads.push(route.request().postDataJSON()); return route.fulfill({ status: 503, json: { code: 'AUTH_NOT_CONFIGURED' } }); });
  for (const screen of ['home', 'events', 'bots', 'designs']) {
    await page.goto(`/?${screen === 'home' ? '' : `screen=${screen}&`}lang=${locale}`);
    await page.getByRole('button', { name: locale === 'ar' ? 'سجّل دخولك عبر Discord' : 'Sign in with Discord', exact: true }).click();
    await expect.poll(() => payloads.length).toBe(['home', 'events', 'bots', 'designs'].indexOf(screen) + 1);
    expect(payloads.at(-1)).toEqual({ page: screen, locale });
    await expect(page.getByTestId('platform-root')).toHaveClass(`platform platform-${screen}`);
    await expect(page.locator('dialog[open]')).toHaveCount(0);
  }
});
test('signed-out buy signs in with Events context directly and opens no product modal', async ({ page }) => {
  await page.route('**/api/auth?action=session', route => route.fulfill({ status: 401, json: { code: 'DISCORD_AUTH_REQUIRED' } }));
  let context: unknown;
  await page.route('**/api/auth?action=signin', route => { context = route.request().postDataJSON(); return route.fulfill({ status: 503, json: { code: 'AUTH_NOT_CONFIGURED' } }); });
  await page.goto('/?screen=events&lang=ar');
  await page.getByTestId('product-card-qc').click();
  await expect.poll(() => context).toEqual({ page: 'events', locale: 'ar' });
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  await expect(page.getByTestId('event-keys')).toHaveCount(0);
});
test('account avatar and keyboard menu stay accessible on desktop; mouse hover reveals history', async ({ page }, info) => {
  await session(page); await page.route('**/api/host', route => route.fulfill(ok({ ...dashboard, events: [] })));
  await page.route('https://cdn.discordapp.com/**', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="#5865f2"/></svg>' }));
  await page.goto('/?screen=events&lang=ar');
  const account = page.locator('.platform-account-trigger');
  await expect(account).toContainText('مقدم المجتمع');
  await expect(account.locator('img')).toHaveAttribute('src', 'https://cdn.discordapp.com/avatars/123/abc.png');
  await account.hover(); await expect(page.getByRole('menu')).toBeVisible();
  await account.focus(); await page.keyboard.press('Escape'); await expect(account).toBeFocused();
  await page.keyboard.press('ArrowDown'); await expect(page.getByRole('menuitem', { name: 'السجل', exact: true })).toBeFocused();
  await page.keyboard.press('End'); await expect(page.getByRole('menuitem', { name: 'تسجيل الخروج', exact: true })).toBeFocused();
  await page.keyboard.press('Home'); await expect(page.getByRole('menuitem', { name: 'السجل', exact: true })).toBeFocused();
  await page.screenshot({ path: info.outputPath('account-menu-desktop.png'), fullPage: true, animations: 'disabled' });
  await page.keyboard.press('Escape'); await expect(page.getByRole('menu')).toHaveCount(0);
  await expect(page.getByTestId('event-keys')).toContainText('2');
  await page.getByRole('heading', { name: 'فعاليات بُعد' }).hover();
  await account.click(); await expect(page.getByRole('menu')).toBeVisible();
});
test('touch account menu toggles by tap and closes outside on mobile', async ({ browser }, info) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await context.newPage(); await session(page);
  await page.route('**/api/host', route => route.fulfill(ok({ ...dashboard, events: [] })));
  await page.goto('http://127.0.0.1:4173/?screen=events&lang=ar');
  const account = page.locator('.platform-account-trigger');
  await account.tap(); await expect(page.getByRole('menu')).toBeVisible();
  await page.screenshot({ path: info.outputPath('account-menu-mobile.png'), fullPage: true, animations: 'disabled' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await account.tap(); await expect(page.getByRole('menu')).toHaveCount(0);
  await account.tap(); await page.getByRole('heading', { name: 'فعاليات بُعد' }).tap(); await expect(page.getByRole('menu')).toHaveCount(0);
  await context.close();
});
test('real zero keys differs from an unavailable balance and refresh focus updates ownership', async ({ page }) => {
  await session(page);
  let credits = 0; let fail = false; let requests = 0;
  await page.route('**/api/host', route => { requests++; return route.fulfill(fail ? { status: 503, json: { code: 'BACKEND_UNAVAILABLE' } } : ok({ ...dashboard, credits, events: [] })); });
  await page.goto('/?screen=events&lang=ar');
  await expect(page.getByTestId('event-keys')).toContainText('0'); await expect(page.getByTestId('event-setup')).toHaveCount(0);
  fail = true; await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByText('تعذر تحميل مفاتيحك.', { exact: false })).toBeVisible(); await expect(page.getByTestId('event-keys')).toHaveCount(0);
  fail = false; credits = 7; await page.locator('.platform-inline-retry').click();
  await expect(page.getByTestId('event-keys')).toContainText('7'); await expect(page.getByTestId('event-setup')).toBeVisible();
  credits = 9; await page.evaluate(() => window.dispatchEvent(new Event('focus'))); await expect(page.getByTestId('event-keys')).toContainText('9'); expect(requests).toBeGreaterThanOrEqual(4);
});
test('direct checkout retries retain one key without a second product modal', async ({ page }) => {
  await session(page); await page.route('**/api/host', route => route.fulfill(ok({ ...dashboard, events: [] })));
  const payloads: { idempotencyKey: string }[] = [];
  await page.route('**/api/checkout', route => { payloads.push(route.request().postDataJSON()); return payloads.length === 1 ? route.abort('connectionfailed') : route.fulfill({ status: 503, json: { code: 'SANDBOX_CHECKOUT_DISABLED' } }); });
  await page.goto('/?screen=events&lang=ar');
  await page.getByTestId('product-card-qc').click(); await expect(page.locator('.platform-account-notice')).toContainText('تعذر');
  await page.getByTestId('product-card-qc').click(); await expect.poll(() => payloads.length).toBe(2);
  expect(payloads[0]).toEqual(payloads[1]); expect(payloads[0].idempotencyKey).toMatch(/^[a-f0-9-]{36}$/);
  await expect(page.locator('dialog[open]')).toHaveCount(0); await expect(page.locator('.platform-account-notice')).toContainText('الشراء غير متاح');
});
test('pending logout suppresses focus refresh and clears private state even after provider failure', async ({ page }) => {
  let sessionReads = 0; let dashboardReads = 0; let loggedOut = false; let logoutStarted = false;
  let releaseLogout!: () => void;
  const logoutGate = new Promise<void>(resolve => { releaseLogout = resolve; });
  await page.route('**/api/auth?action=session', route => { sessionReads++; return route.fulfill(loggedOut ? { status: 401, json: { code: 'DISCORD_AUTH_REQUIRED' } } : ok({ id: 'host-1', displayName: 'مقدم المجتمع' })); });
  await page.route('**/api/host', route => { dashboardReads++; return route.fulfill(ok(dashboard)); });
  await page.route('**/api/auth?action=logout', async route => { logoutStarted = true; await logoutGate; loggedOut = true; await route.fulfill({ status: 503, json: { code: 'AUTH_REVOCATION_UNAVAILABLE' } }); });
  await page.goto('/?screen=events&lang=ar');
  await expect(page.getByTestId('event-keys')).toContainText('2');
  const account = page.locator('.platform-account-trigger'); await account.focus(); await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('menuitem', { name: 'السجل', exact: true })).toBeFocused(); await page.keyboard.press('End');
  await expect(page.getByRole('menuitem', { name: 'تسجيل الخروج', exact: true })).toBeFocused(); await page.keyboard.press('Enter');
  await expect.poll(() => logoutStarted).toBe(true); await expect(account).toBeDisabled();
  const before = { sessionReads, dashboardReads };
  await page.evaluate(async () => { window.dispatchEvent(new Event('focus')); window.dispatchEvent(new Event('focus')); await new Promise(resolve => setTimeout(resolve, 0)); });
  expect({ sessionReads, dashboardReads }).toEqual(before);
  releaseLogout();
  await expect(page.getByRole('button', { name: 'سجّل دخولك عبر Discord', exact: true })).toBeVisible();
  await expect(page.getByTestId('event-keys')).toHaveCount(0); await expect(page.getByTestId('event-setup')).toHaveCount(0); await expect(page.getByRole('button', { name: 'استكمال الفعالية', exact: true })).toHaveCount(0);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect.poll(() => sessionReads).toBe(before.sessionReads + 1);
  await expect(page.locator('.platform-account-trigger')).toHaveCount(0); expect(dashboardReads).toBe(before.dashboardReads);
});
test('keyboard History and setup panels focus their headings and restore the initiating controls', async ({ page }) => {
  await session(page); await page.route('**/api/host', route => route.fulfill(ok({ ...dashboard, events: [] })));
  await page.goto('/?screen=events&lang=ar');
  const account = page.locator('.platform-account-trigger');
  await account.focus(); await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('menuitem', { name: 'السجل', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('.host-embedded').getByRole('heading', { name: 'السجل', exact: true })).toBeFocused();
  await expect(page.locator('.host-balance')).toHaveCount(0); await expect(page.getByLabel('اسم الفعالية')).toHaveCount(0);
  await page.locator('.host-back').focus(); await page.keyboard.press('Enter');
  await expect(page.locator('.host-embedded')).toHaveCount(0); await expect(account).toBeFocused();
  const setup = page.getByTestId('event-setup'); await setup.focus(); await page.keyboard.press('Enter');
  await expect(page.locator('.host-embedded h1')).toBeFocused(); await expect(page.getByLabel('اسم الفعالية')).toBeVisible();
  await page.locator('.host-back').focus(); await page.keyboard.press('Enter');
  await expect(page.locator('.host-embedded')).toHaveCount(0); await expect(setup).toBeFocused();
});
test('expired embedded history session clears parent account and keys instead of leaving stale identity', async ({ page }) => {
  await session(page);
  let dashboardReads = 0;
  await page.route('**/api/host', route => { dashboardReads++; return route.fulfill(dashboardReads === 1 ? ok(dashboard) : { status: 401, json: { code: 'DISCORD_AUTH_REQUIRED' } }); });
  await page.goto('/?screen=events&lang=ar');
  await expect(page.getByTestId('event-keys')).toContainText('2');
  await page.locator('.platform-account-trigger').focus(); await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('menuitem', { name: 'السجل', exact: true })).toBeFocused(); await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'سجّل دخولك عبر Discord', exact: true })).toBeVisible();
  await expect(page.locator('.platform-account-trigger')).toHaveCount(0);
  await expect(page.getByText('مقدم المجتمع', { exact: true })).toHaveCount(0);
  await expect(page.getByTestId('event-keys')).toHaveCount(0); await expect(page.getByTestId('event-setup')).toHaveCount(0);
  await expect(page.locator('.host-embedded')).toHaveCount(0);
  expect(dashboardReads).toBeGreaterThanOrEqual(2);
});


test('long Discord names preserve the home viewport and account menu at mobile and desktop widths', async ({page}, info) => {
  await page.route('**/api/auth?action=session',route=>route.fulfill(ok({id:'host-1',displayName:'مقدم مجتمع بُعد '.repeat(5),avatarUrl:null})));
  await page.route('**/api/host',route=>route.fulfill(ok(dashboard)));
  for(const locale of ['ar','en']) for(const size of [{width:320,height:568},{width:390,height:844},{width:1440,height:900}]) {
    await page.setViewportSize(size); await page.goto('/?lang='+locale);
    const account=page.locator('.platform-account-trigger'); await expect(account).toBeVisible();
    await page.evaluate(()=>document.fonts.ready);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBeTruthy();
    await expect(page.getByTestId('hero-explore')).toBeInViewport({ratio:1});
    await expect(page.locator('.platform-footer')).toBeInViewport({ratio:1});
    await account.focus(); await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('menu')).toBeInViewport({ratio:1});
    await expect(page.getByRole('menu')).toHaveCSS('direction',locale==='ar'?'rtl':'ltr');
    await page.screenshot({path:info.outputPath('account-'+locale+'-'+size.width+'.png'),fullPage:true});
    await page.keyboard.press('Escape'); await expect(page.getByRole('menu')).toHaveCount(0);
  }
});
