import { test, expect } from '@playwright/test';
const host = '11111111-1111-4111-8111-111111111111', order = '22222222-2222-4222-8222-222222222222';
for (const locale of ['ar','en'] as const) {
  test(`payment status follows server truth, refreshes balance and fits ${locale}`, async ({ page }) => {
    await page.setViewportSize(locale === 'ar' ? { width:390, height:844 } : { width:1440, height:900 });
    let state = 'pending', dashboardCalls = 0, checkoutCalls = 0;
    await page.route('**/api/auth**', route => route.fulfill({ json:{ code:'OK',data:{ id:host,displayName:'Fixture host' } } }));
    await page.route('**/api/host', route => { dashboardCalls++; return route.fulfill({ json:{ code:'OK',data:{ credits:state === 'pending' ? 0 : 1,paymentReview:state === 'refunded',events:[], products:[],contentVersions:[] } } }); });
    await page.route('**/api/checkout', route => { checkoutCalls++; return route.fulfill({ status:503,json:{ code:'SANDBOX_CHECKOUT_NOT_CONFIGURED' } }); });
    await page.route('**/api/payment-status', route => {
      expect(route.request().method()).toBe('POST'); expect(route.request().postDataJSON()).toEqual({ orderId:order });
      return route.fulfill({ json:{ code:'OK',data:{ orderId:order,state,currency:'sar',amountMinor:200,createdAt:'2026-10-23T10:00:00Z',checkedAt:null } } });
    });
    await page.goto(`/?screen=events&lang=${locale}&order=${order}&paid=true`);
    const panel = page.getByTestId('payment-status');
    await expect(panel.getByRole('status')).toHaveText(locale === 'ar' ? 'الدفع قيد التحقق' : 'Payment confirmation pending');
    expect(new URL(page.url()).searchParams.get('paid')).toBeNull();
    await expect(panel).toContainText(order);
    await page.screenshot({ path:`artifacts/payment-status-${locale}-pending.png`,fullPage:true });
    state = 'confirmed';
    await panel.getByRole('button').click();
    await expect(panel.getByRole('status')).toHaveText(locale === 'ar' ? 'تم تأكيد الدفع' : 'Payment confirmed');
    await expect.poll(() => dashboardCalls).toBeGreaterThan(1);
    await expect(page.getByTestId('event-setup')).toBeVisible();
    state = 'refunded'; await panel.getByRole('button').click();
    await expect(panel.getByRole('status')).toHaveText(locale === 'ar' ? 'تم تأكيد استرداد الدفعة' : 'Payment refund confirmed');
    await expect(page.getByTestId('event-setup')).toHaveCount(0);
    expect(checkoutCalls).toBe(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    await page.screenshot({ path:`artifacts/payment-status-${locale}-refunded.png`,fullPage:true });
  });
  test(`failed verification does not show payment success or another person's old receipt ${locale}`, async ({ page }) => {
    await page.route('**/api/auth**', route => route.fulfill({ json:{ code:'OK',data:{ id:host,displayName:'Fixture host' } } }));
    await page.route('**/api/host', route => route.fulfill({ json:{ code:'OK',data:{ credits:0,events:[],products:[],contentVersions:[] } } }));
    await page.route('**/api/payment-status', route => route.fulfill({ status:503,json:{ code:'PAYMENT_STATUS_UNAVAILABLE' } }));
    await page.goto(`/?screen=events&lang=${locale}&order=${order}&success=true`);
    const panel = page.getByTestId('payment-status');
    await expect(panel.getByRole('status')).toHaveText(locale === 'ar' ? 'تعذر التحقق من حالة الطلب الآن.' : 'We cannot verify your order status right now.');
    await expect(panel).not.toContainText(locale === 'ar' ? 'تم تأكيد الدفع' : 'Payment confirmed');
  });
}
test('a payment query without a valid order cannot create a success screen', async ({ page }) => {
  await page.route('**/api/auth**', route => route.fulfill({ status:401,json:{ code:'DISCORD_AUTH_REQUIRED' } }));
  await page.goto('/?screen=events&lang=ar&order=forged&paid=true');
  await expect(page.getByTestId('payment-status')).toHaveCount(0);
});

test('explicit pilot inspection performs an empty protected POST and creates no checkout', async ({page}) => {
  let inspections=0,checkouts=0;
  await page.route('**/api/auth**',route=>route.fulfill({json:{code:'OK',data:{id:host,displayName:'Fixture host'}}}));
  await page.route('**/api/host',route=>route.fulfill({json:{code:'OK',data:{credits:0,events:[],products:[],contentVersions:[]}}}));
  await page.route('**/api/checkout',route=>{checkouts++;return route.fulfill({status:503,json:{code:'DISABLED'}});});
  await page.route('**/api/whop-preflight',route=>{
    inspections++;expect(route.request().method()).toBe('POST');expect(route.request().postData()).toBeNull();
    return route.fulfill({json:{code:'OK',data:{companyId:'biz_fixture123',productId:'prod_fixture123',planId:'plan_fixture123',currency:'sar',amountMinor:200,checkoutCreated:false,paymentCreated:false,creditGranted:false}}});
  });
  await page.goto('/?screen=events&lang=ar&check=whop');
  const inspection=page.getByTestId('whop-preflight');await inspection.getByRole('button').click();
  await expect(inspection.getByRole('status')).toContainText('لم يُنشأ طلب شراء');
  expect(inspections).toBe(1);expect(checkouts).toBe(0);
});
