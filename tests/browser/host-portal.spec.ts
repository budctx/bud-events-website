import { test, expect } from '@playwright/test';
import { manualGameReducer } from '../../src/manual-game';
import type { ManualState } from '../../src/manual-game';
const initialState = { phase: 'live', config: { duration: 5, timerEnabled: false, attempts: 1 }, prizes: [{ id: 'prize-1', name: 'قسيمة', revealed: false, winnerId: null }], winners: [], nextWinnerNumber: 1, question: false, condition: false, attempt: 1, round: 0, deadline: null, remaining: 5, pendingWinner: false };
const active = { eventId: 'event-1', title: 'لقاء المجتمع', phase: 'active', version: 1, state: initialState };
const dashboard = { credits: 2, events: [active], products: [{ id: 'question-condition', name: 'سؤال وشرط', available: true, slotCost: 1 }], contentVersions: [{ id: 'qc-v1', questionCount: 6, conditionCount: 6 }] };
const ok = (data: unknown) => ({ status: 200, json: { code: 'OK', data } });
async function session(page: import('@playwright/test').Page) { await page.route('**/api/auth?action=session', route => route.fulfill(ok({ id: 'host-1', displayName: 'مقدم المجتمع' }))); }
test('host portal fails closed without sign in or configured backend', async ({ page }) => {
  await page.route('**/api/auth?action=session', route => route.fulfill({ status: 401, json: { code: 'AUTH_REQUIRED' } }));
  await page.goto('/?screen=host&lang=ar');
  await expect(page.getByRole('heading', { name: 'سجّل دخولك' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'بدء الفعالية', exact: true })).toHaveCount(0);
  await page.route('**/api/auth?action=signin', route => route.fulfill({ status: 503, json: { code: 'AUTH_UNAVAILABLE' } }));
  await page.getByRole('button', { name: 'Discord سجّل دخولك' }).click();
  await expect(page.getByRole('alert')).toContainText('غير متاحة');
});
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
  await expect(page.getByText('مرات التشغيل المتاحة', { exact: true })).toBeVisible();
  await page.getByLabel('اسم الفعالية').fill('جلسة مميزة');
  await page.getByLabel('الجوائز', { exact: true }).fill('قسيمة\nقسيمة');
  await page.getByRole('button', { name: 'بدء الفعالية', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByLabel('اسم الفعالية')).toBeDisabled();
  await page.getByRole('button', { name: 'إعادة المحاولة', exact: true }).click();
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
  await expect(page.getByRole('button', { name: 'بدء الفعالية', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'عرض الملخص' }).click();
  await expect(page.getByRole('dialog')).toContainText('سارة');
  expect(requests).toEqual(['dashboard']);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
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

