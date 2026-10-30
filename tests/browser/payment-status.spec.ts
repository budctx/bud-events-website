import { test, expect } from '@playwright/test';
test.beforeEach(async({page})=>{await page.route('**/api/checkout?price=1',r=>r.fulfill({status:200,json:{code:'OK',data:{baseAmountMinor:2000,amountMinor:2000,currency:'sar',promotion:null}}}));});
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
    await expect(page.locator('.bud-toast')).toContainText('الدفع قيد التحقق');
    expect(new URL(page.url()).searchParams.get('paid')).toBeNull();
    await expect(panel).toContainText(order);
    await page.screenshot({ path:`artifacts/payment-status-${locale}-pending.png`,fullPage:true });
    state = 'confirmed';
    await panel.getByRole('button',{name:'تحديث الحالة'}).click();
    await expect(page.locator('.bud-toast')).toContainText('تم تأكيد الدفع');
    await expect.poll(() => dashboardCalls).toBeGreaterThan(1);
    await expect(page.getByTestId('event-setup')).toBeVisible();
    state = 'refunded'; await panel.getByRole('button',{name:'تحديث الحالة'}).click();
    await expect(page.locator('.bud-toast')).toContainText('تم تأكيد استرداد الدفعة');
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
    await expect(page.locator('.bud-toast')).toContainText('تعذر التحقق من حالة الطلب الآن.');
    await expect(panel).not.toContainText('تم تأكيد الدفع');
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
    return route.fulfill({json:{code:'OK',data:{companyId:'biz_fixture123',productId:'prod_fixture123',planId:'plan_fixture123',currency:'sar',amountMinor:300,checkoutCreated:false,paymentCreated:false,creditGranted:false}}});
  });
  await page.goto('/?screen=events&lang=ar&check=whop');
  const inspection=page.getByTestId('whop-preflight');await inspection.getByRole('button', {name:'التحقق من الخطة', exact:true}).click();
  await expect(page.locator('.bud-toast')).toContainText('لم يُنشأ طلب شراء');await expect(inspection.locator('p[role=status]')).toHaveCount(0);
  expect(inspections).toBe(1);expect(checkouts).toBe(0);
  await page.unroute('**/api/whop-preflight');
  await page.route('**/api/whop-preflight',route=>route.fulfill({status:503,json:{code:'WHOP_PRODUCTION_ACCESS_DENIED',privateDetails:'must-not-display'}}));
  await inspection.getByRole('button', {name:'التحقق من الخطة', exact:true}).click();
  await expect(page.locator('.bud-toast')).toContainText('رفض Whop صلاحية الوصول');
  await expect(inspection).not.toContainText('must-not-display');expect(checkouts).toBe(0);
  await page.unroute('**/api/whop-preflight');
  await page.route('**/api/whop-preflight',route=>route.fulfill({status:409,json:{code:'PRODUCTION_PLAN_MISMATCH',data:{mismatches:['company','tax'],settings:{conversion:'disabled',taxCollection:'enabled',taxType:'exclusive'},private:'must-not-display'}}}));
  await inspection.getByRole('button', {name:'التحقق من الخطة', exact:true}).click();
  await expect(page.locator('.bud-toast')).toContainText('حقول لم تجتز المطابقة: حساب البيع، الضريبة');
  await expect(page.locator('.bud-toast')).toContainText('تحويل العملة: معطّل؛ تحصيل الضريبة: مفعّل؛ أسلوب الضريبة: تضاف عند احتسابها');
  await expect(inspection).not.toContainText('must-not-display');expect(checkouts).toBe(0);
  await page.screenshot({path:'artifacts/whop-admin-fields.png',fullPage:true});
});

test('independent quote is explicit, country preview only and never a purchase or launch success',async({page})=>{
 let quotes=0,checkouts=0;
 await page.route('**/api/auth**',route=>route.fulfill({json:{code:'OK',data:{id:host,displayName:'Fixture host'}}}));
 await page.route('**/api/host',route=>route.fulfill({json:{code:'OK',data:{credits:0,events:[],products:[],contentVersions:[]}}}));
 await page.route('**/api/checkout',route=>{checkouts++;return route.fulfill({status:503,json:{code:'DISABLED'}});});
 await page.route('**/api/whop-quote',route=>{
  quotes++;expect(route.request().postData()).toBeNull();
  return route.fulfill({json:{code:'OK',data:{previewOnly:true,country:'SA',currency:'sar',quantity:1,totalMinor:230,taxAmountMinor:30,
   paymentCreated:false,checkoutCreated:false,creditGranted:false,privateCustomer:'must-not-display'}}});
 });
 await page.setViewportSize({width:390,height:844});
 await page.goto('/?screen=events&lang=ar&check=whop');
 const panel=page.getByTestId('whop-preflight');await expect(panel).toBeVisible();expect(quotes).toBe(0);
 await panel.getByRole('button',{name:'عرض سعر تقديري — السعودية'}).click();
 await expect(page.locator('.bud-toast')).toContainText('ليس سعرًا نهائيًا لعميل');
 await expect(panel).not.toContainText('must-not-display');expect(quotes).toBe(1);expect(checkouts).toBe(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await page.screenshot({path:'artifacts/whop-quote-ar390.png',fullPage:true});
 await page.setViewportSize({width:1440,height:900});
 await expect(page.getByTestId('locale-toggle')).toHaveCount(0);
 await panel.getByRole('button',{name:'عرض سعر تقديري — السعودية'}).click();
 await expect(page.locator('.bud-toast')).toContainText('ليس سعرًا نهائيًا لعميل');expect(checkouts).toBe(0);
 await page.screenshot({path:'artifacts/whop-quote-en1440.png',fullPage:true});
 await page.unroute('**/api/whop-quote');
 await page.route('**/api/whop-quote',route=>route.fulfill({status:503,json:{code:'WHOP_PRODUCTION_REQUEST_REJECTED',data:{request:{operation:'quote_preview',providerStatus:422,reason:'required_field',field:'company_id'},privateDetails:'never-display'}}}));
 await panel.getByRole('button',{name:'عرض سعر تقديري — السعودية'}).click();
 await expect(page.locator('.bud-toast')).toContainText('رفض Whop طلب التسعير: حقل مطلوب (company_id)');
 await expect(panel).not.toContainText('never-display');expect(checkouts).toBe(0);
});

for(const width of [390,1440])test(`payment toasts persist when critical, close by icon and do not repeat after refresh ${width}`,async({page},info)=>{
 await page.setViewportSize({width,height:900});await page.emulateMedia({reducedMotion:'reduce'});
 const refresh=async()=>{const response=page.waitForResponse(r=>r.url().endsWith('/api/payment-status'));await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await response;};
 let state='pending';
 await page.route('**/api/auth**',route=>route.fulfill({json:{code:'OK',data:{id:host,displayName:'Fixture'}}}));
 await page.route('**/api/host',route=>route.fulfill({json:{code:'OK',data:{credits:state==='confirmed'?1:0,events:[],products:[],contentVersions:[]}}}));
 await page.route('**/api/payment-status',route=>route.fulfill({json:{code:'OK',data:{orderId:order,state,currency:'sar',amountMinor:300,createdAt:'2026-10-29T10:00:00Z',checkedAt:null}}}));
 await page.route('**/api/checkout',route=>route.fulfill({status:503,json:{code:'LIVE_COMMERCE_DISABLED'}}));
 await page.clock.install();await page.goto(`/?screen=events&order=${order}`);
 const pending=page.locator('.bud-toast').filter({hasText:'الدفع قيد التحقق'});
 await expect(pending).toHaveAttribute('data-duration','persistent');
 const viewport=page.locator('.bud-toast-viewport');const bounds=await viewport.boundingBox();expect(bounds).not.toBeNull();expect(width-bounds!.x-bounds!.width).toBeGreaterThanOrEqual(15);expect(width-bounds!.x-bounds!.width).toBeLessThan(40);expect(900-bounds!.y-bounds!.height).toBeGreaterThanOrEqual(15);expect(900-bounds!.y-bounds!.height).toBeLessThan(40);
 await expect(page.locator('.platform-payment-status')).toHaveCount(0);const toastBounds=await pending.boundingBox();expect(toastBounds!.x).toBeGreaterThanOrEqual(16);expect(toastBounds!.x+toastBounds!.width).toBeLessThanOrEqual(width-16);await expect(pending.locator('strong')).toHaveText('الدفع قيد التحقق');await expect(pending.locator('.bud-toast-copy>p').first()).toContainText('قد يتأخر التأكيد');await page.screenshot({path:info.outputPath('payment-toast.png')});
 for(let i=0;i<4;i++){await page.getByTestId('product-card-qc').focus();await page.keyboard.press('Enter');await expect(page.locator('.bud-toast[data-tone=danger]')).toHaveCount(i+1);}
 await expect(pending).toHaveCount(1);await expect(page.locator('.bud-toast[data-tone=danger]').first()).toHaveAttribute('data-duration','20000');
 await page.mouse.move(width-1,899);await page.clock.fastForward(20001);await expect(page.locator('.bud-toast[data-tone=danger]')).toHaveCount(0);
 await page.clock.fastForward(30000);await expect(pending).toHaveCount(1);
 await pending.getByRole('button',{name:'إغلاق التنبيه'}).click();await expect(pending).toHaveCount(0);
 await refresh();await expect(pending).toHaveCount(0);
 state='confirmed';await refresh();
 const success=page.locator('.bud-toast').filter({hasText:'تم تأكيد الدفع'});await expect(success).toHaveAttribute('data-duration','5000');
 await page.mouse.move(width-1,0);await page.getByTestId('nav-home').focus();await page.clock.fastForward(5001);await expect(success).toHaveCount(0);
 await refresh();await expect(success).toHaveCount(0);
 state='review';await refresh();
 const warning=page.locator('.bud-toast').filter({hasText:'الطلب قيد المراجعة'});await expect(warning).toHaveAttribute('data-duration','persistent');await page.clock.fastForward(60000);await expect(warning).toBeVisible();
 await warning.getByRole('button',{name:'إغلاق التنبيه'}).focus();await page.keyboard.press('Enter');await expect(warning).toHaveCount(0);
 state='confirmed';await refresh();await expect(success).toBeVisible();
 await page.getByTestId('nav-home').focus();await page.keyboard.press('Enter');await expect(success).toBeVisible();
 state='review';await success.getByRole('button',{name:'تحديث الحالة'}).click();await expect(warning).toBeVisible();state='confirmed';await warning.getByRole('button',{name:'تحديث الحالة'}).click();await expect(success).toBeVisible();
 await page.mouse.move(width-1,899);await page.mouse.move(width-1,0);await page.getByTestId('nav-home').focus();await page.clock.fastForward(5001);await expect(success).toHaveCount(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
