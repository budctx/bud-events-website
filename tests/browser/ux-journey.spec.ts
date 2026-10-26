import { test, expect } from '@playwright/test';

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
  await expect(page.getByTestId('product-card-qc')).toHaveText('اشترِ الآن — ٣ ر.س');
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
  await page.getByTestId('nav-events').click();
  await expect(page).toHaveURL(/screen=events/);
  await page.locator('.platform-account-trigger').click();
  await page.getByRole('menuitem',{name:'الملف الشخصي'}).click();
  await expect(page).toHaveURL(/panel=profile/);
  await expect(page.locator('.owner-profile')).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/screen=events/);
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
  await expect(page.getByTestId('product-card-qc')).toHaveText('اشترِ الآن — ٣ ر.س');
  await expect(page.locator('.platform-account-notice')).toContainText('الشراء غير متاح');
});
