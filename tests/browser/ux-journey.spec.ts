import { test, expect } from '@playwright/test';
async function navigate(page:import('@playwright/test').Page,id:string,method:'click'|'tap'='click'){
 const toggle=page.getByRole('button',{name:'فتح قائمة التنقل'});
 if(!await page.getByRole('dialog',{name:'قائمة التنقل'}).isVisible()&&await toggle.isVisible())await toggle.click();
 const link=page.getByTestId('nav-'+id);
 if(method==='tap')await link.tap();else await link.click();
}

test.beforeEach(async({page})=>{await page.route('**/api/checkout?price=1',r=>r.fulfill({status:200,json:{code:'OK',data:{baseAmountMinor:2000,amountMinor:2000,currency:'sar',promotion:null}}}));});

const ok = (data: unknown) => ({status:200,json:{code:'OK',data}});
const owner = {id:'host-ux-a',displayName:'مقدم بُعد'};
const dashboard = {ownerId:owner.id, credits:2,events:[],products:[{id:'question-condition',name:'سؤال وشرط',available:true,slotCost:1}],contentVersions:[{id:'qc-v1',questionCount:5,conditionCount:5}]};
async function setup(page:import('@playwright/test').Page, data:typeof dashboard=dashboard) {
  await page.route('**/api/auth?action=session',route=>route.fulfill(ok(owner)));
  await page.route('**/api/host',route=>route.fulfill(ok(data)));
}

test('Hick: a signed-in host with slots sees setup as the main action, not purchasing', async({page})=>{
  await setup(page);
  await page.goto('/?screen=events');
  await expect(page.getByTestId('event-setup')).toHaveClass(/platform-action-primary/);
  await expect(page.getByTestId('product-card-qc')).toHaveClass(/platform-action-secondary/);
  await expect(page.getByTestId('product-card-qc')).toHaveText('شراء 20');
});

test('Hick: when an event is active, resume is the primary action; without slots buying stays primary',async({page})=>{
  const active = {eventId:'event-ux',title:'فعالية جارية',phase:'live',version:1,
    state:{phase:'live',config:{duration:5,timerEnabled:false,attempts:1},winners:[],prizes:[],nextWinnerNumber:1,question:false,condition:false,attempt:1,round:0,deadline:null,remaining:5,pendingWinner:false}};
  await setup(page,{...dashboard,events:[active]} as typeof dashboard);
  await page.goto('/?screen=events');
  await expect(page.getByTestId('event-resume')).toHaveClass(/platform-action-primary/);
  await expect(page.getByTestId('event-setup')).toHaveClass(/platform-action-secondary/);
  await expect(page.getByTestId('product-card-qc')).toHaveClass(/platform-action-secondary/);
  await page.unroute('**/api/host');
  await page.route('**/api/host',route=>route.fulfill(ok({...dashboard,credits:0,events:[]})));
  await page.reload();
  await expect(page.getByTestId('event-setup')).toHaveCount(0);
  await expect(page.getByTestId('product-card-qc')).toHaveClass(/platform-action-primary/);
});

test('Jakob: browser back and forward restore the page and account panel',async({page})=>{
  await setup(page);
  await page.goto('/?lang=ar');
  await navigate(page,'events');
  await expect(page).toHaveURL(/\/events(?:[?#]|$)/);
  await page.locator('.platform-account-trigger').click();
  await page.getByRole('menuitem',{name:'الملف الشخصي'}).click();
  await expect(page).toHaveURL(/panel=profile/);
  await expect(page.locator('.owner-profile')).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/events(?:[?#]|$)/);
  await expect(page).not.toHaveURL(/panel=profile/);
  await expect(page.getByTestId('product-card-qc')).toBeVisible();
  await page.goBack();
  await expect(page.getByTestId('hero-explore')).toBeVisible();
  await page.goForward();
  await expect(page.getByTestId('product-card-qc')).toBeVisible();
});

test('Zeigarnik: an account-scoped setup draft survives reload without making a paid request',async({page})=>{
  const requests:string[]=[];
  await page.route('**/api/auth?action=session',route=>route.fulfill(ok(owner)));
  await page.route('**/api/host',route=>{const body=route.request().postDataJSON();requests.push(body.action);return route.fulfill(ok(dashboard));});
  await page.goto('/?screen=events');
  await page.getByTestId('event-setup').click();
  await expect(page).toHaveURL(/panel=setup/);
  await page.getByLabel('اسم الفعالية').fill('جلسة المجتمع');
  await page.getByLabel('الجوائز',{exact:true}).fill('هدية أولى\nهدية ثانية');
  await page.getByRole('switch',{name:'تفعيل المؤقت'}).click();
  await page.getByLabel('مدة المؤقت بالثواني').fill('13');
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('bud-host-setup-draft:v1:host-ux-a')||'null')?.title)).toBe('جلسة المجتمع');
  await page.reload();
  await expect(page.getByLabel('اسم الفعالية')).toHaveValue('جلسة المجتمع');
  await expect(page.getByLabel('الجوائز',{exact:true})).toHaveValue('هدية أولى\nهدية ثانية');
  await expect(page.getByRole('switch',{name:'تفعيل المؤقت'})).toBeChecked();
  await expect(page.getByLabel('مدة المؤقت بالثواني')).toHaveValue('13');
  expect(requests.every(action=>action==='dashboard')).toBe(true);
});

test('Doherty: buy shows its pending state immediately without pretending success',async({page})=>{
  await page.route('**/api/auth?action=session',r=>r.fulfill(ok(owner)));
  await page.route('**/api/host',r=>r.fulfill(ok({...dashboard,credits:0})));
  let release!:()=>void;
  const gated = new Promise<void>(resolve=>{release=resolve;});
  await page.route('**/api/checkout',async route=>{await gated;await route.fulfill({status:503,json:{code:'LIVE_COMMERCE_DISABLED'}});});
  await page.goto('/?screen=events');
  await page.getByTestId('product-card-qc').click();
  await expect(page.getByTestId('product-card-qc')).toHaveText('جارٍ تجهيز الشراء…');
  await expect(page.getByRole('status').filter({hasText:'جارٍ التحقق من طلب الشراء…'})).toBeVisible();
  release();
  await expect(page.getByTestId('product-card-qc')).toHaveText('شراء 20');
  await expect(page.locator('.bud-toast[data-tone=danger]').last()).toContainText('الشراء غير متاح');
  await expect(page.locator('.bud-toast[data-tone=danger]').last()).toHaveAttribute('data-duration','20000');
});

for(const mode of ['mouse','keyboard','touch','reduced'] as const)test.describe(`purchase ripple ${mode}`,()=>{
 test.use({hasTouch:mode==='touch'});
 test('shows price and riyal, preserves pending protection and respects input/motion',async({page})=>{
  await page.setViewportSize({width:mode==='touch'?390:1440,height:900});
  if(mode==='reduced')await page.emulateMedia({reducedMotion:'reduce'});
  await setup(page,{...dashboard,credits:0});
  let calls=0,release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});
  await page.route('**/api/checkout',async route=>{calls++;await gate;await route.fulfill({status:503,json:{code:'LIVE_COMMERCE_DISABLED'}});});
  await page.goto('/?screen=events');const buy=page.getByTestId('product-card-qc');
  await expect(buy).toBeEnabled();await expect(buy).toHaveText('شراء 20');await expect(buy).toHaveAccessibleName('شراء 20');await expect(buy).toHaveAccessibleDescription('ريال سعودي — مفتاح فعالية سؤال وشرط');
  const currency=buy.locator('img');await expect.poll(()=>currency.evaluate((img:HTMLImageElement)=>img.complete&&img.naturalWidth>0)).toBe(true);
  const symbol=await currency.boundingBox(),number=await buy.locator('bdi').boundingBox();expect(symbol!.x+symbol!.width).toBeLessThanOrEqual(number!.x+1);
  const before=await buy.boundingBox();await page.clock.install();await page.clock.pauseAt((await page.evaluate(()=>Date.now()))+1000);
  if(mode==='keyboard'){await buy.focus();await buy.press('Enter');}else if(mode==='touch')await buy.tap();else await buy.click();
  await expect(buy).toBeDisabled();await expect(buy).toHaveAttribute('aria-busy','true');await expect(buy).toHaveText('جارٍ تجهيز الشراء…');
  await expect(buy.locator('.bud-button-wave')).toHaveCount(mode==='reduced'?0:1);
  expect((await buy.boundingBox())!.width).toBeCloseTo(before!.width,0);
  if(mode==='touch')expect(await buy.evaluate(el=>getComputedStyle(el).outlineStyle)).toBe('none');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.clock.runFor(650);await expect(buy.locator('.bud-button-wave')).toHaveCount(0);await expect.poll(()=>calls).toBe(1);
  release();await expect(buy).toBeEnabled();await expect(buy).toHaveText('شراء 20');
 });
});

test('coupon link displays only a server verified discount and blocks an invalid code',async({page})=>{
 await page.route('**/api/auth?action=session',r=>r.fulfill({status:401,json:{code:'DISCORD_AUTH_REQUIRED'}}));
 await page.route('**/api/checkout?promoCode=bud10',r=>r.fulfill({status:200,json:{code:'OK',data:{baseAmountMinor:2000,amountMinor:1800,currency:'sar',promotion:{code:'bud10',percent:10}}}}));
 await page.goto('/?screen=events&promoCode=BUD10');
 await expect(page.getByTestId('product-card-qc')).toHaveText('شراء 20 18');
 await expect(page.getByRole('status').filter({hasText:'خصم 10% مفعّل'})).toContainText('bud10');
 await page.route('**/api/checkout?promoCode=invalid',r=>r.fulfill({status:400,json:{code:'PROMO_INVALID'}}));
 await page.goto('/?screen=events&promoCode=invalid');
 await expect(page.getByTestId('product-card-qc')).toBeDisabled();await expect(page.getByRole('alert')).toContainText('لم يُطبّق أي خصم');
 await page.getByRole('button',{name:'المتابعة بدون كوبون'}).click();
 await expect(page.getByTestId('product-card-qc')).toHaveText('شراء 20');await expect(page.getByTestId('product-card-qc')).toBeEnabled();
});
