import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

test.beforeEach(async ({page}) => {
  await page.route('**/api/auth**', route => route.fulfill({status:route.request().url().includes('action=session') ? 401 : 503,json:{code:'AUTH_UNAVAILABLE'}}));
});

const sizes = [ {width:1440,height:900}, {width:1366,height:768}, {width:390,height:844}, {width:375,height:667}, {width:360,height:800} ];

test('built application renders and navigates under the configured production CSP',async({page})=>{
  const config=JSON.parse(readFileSync('vercel.json','utf8'));
  const headers=Object.fromEntries(config.headers.find((rule:any)=>rule.source==='/(.*)').headers.map((entry:any)=>[entry.key,entry.value]));
  const violations:string[]=[];
  page.on('console',message=>{if(message.type()==='error'&&/Content Security Policy|violates.*directive/i.test(message.text()))violations.push(message.text());});
  page.on('pageerror',error=>violations.push(error.message));
  await page.route('http://127.0.0.1:4175/**',async route=>{
    if(route.request().url().includes('/api/auth'))return route.fulfill({status:503,json:{code:'AUTH_NOT_CONFIGURED'},headers});
    const response=await route.fetch();return route.fulfill({response,headers:{...response.headers(),...headers}});
  });
  await page.goto('http://127.0.0.1:4175/?lang=ar');
  await expect(page.getByTestId('hero-explore')).toBeVisible();
  await page.locator('.platform-art img').evaluate((img:HTMLImageElement)=>img.decode());
  await page.getByTestId('hero-explore').click();
  await expect(page.getByTestId('event-preview')).toBeVisible();
  await page.getByTestId('event-preview').getByRole('button').first().click();
  await page.getByRole('button',{name:'سجّل دخولك عبر Discord'}).click();
  await expect(page.locator('.platform-account-notice')).toContainText('تعذر إتمام الطلب');
  await expect(page.getByTestId('event-preview')).toBeVisible();
  expect(violations).toEqual([]);
});
for (const locale of ['ar','en']) for (const size of sizes) {
  test(`platform ${locale} ${size.width}x${size.height}`, async ({ page }, info) => {
    await page.setViewportSize(size);
    const errors:string[]=[]; page.on('pageerror', error => errors.push(error.message));
    await page.goto(`/?lang=${locale}`);
    await expect(page.getByTestId('platform-root')).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('dir',locale==='ar'?'rtl':'ltr');
    await expect(page.getByTestId('nav-events')).toBeVisible();
    await expect(page.getByTestId('nav-designs')).toBeVisible();
    expect(await page.locator('.platform-art img').evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBeTruthy();
    await page.locator('.platform-art img').evaluate((el: HTMLImageElement) => el.decode());
    for (const selector of ['.platform-login', '.platform-language', '[data-testid="nav-events"]', '[data-testid="hero-explore"]']) {
      const control = page.locator(selector);
      const box = await control.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(44);
      expect(await control.evaluate(el => {
        const r = el.getBoundingClientRect();
        return el.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2));
      })).toBeTruthy();
    }
    await expect(page.locator('.platform-art-logo')).toHaveCount(2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth+1)).toBeTruthy();
    await page.screenshot({path:info.outputPath(`home-${locale}-${size.width}.png`),fullPage:true,animations:'disabled'});
    await page.getByTestId('nav-events').click();
    await expect(page.getByTestId('product-card-qc')).toHaveText(locale==='ar'?'اشترِ الآن':'Buy now');
    await expect(page.getByTestId('product-dialog')).toHaveCount(0);
    await page.screenshot({path:info.outputPath(`events-${locale}-${size.width}.png`),fullPage:true,animations:'disabled'});
    await page.getByTestId('nav-bots').click();
    await expect(page.getByTestId('platform-root')).toContainText(locale==='ar'?'قريبًا':'Coming soon');
    expect(errors).toEqual([]);
  });
}

for(const locale of ['ar','en']) test(`manual journey ${locale}`,async({page},info)=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto(`/?screen=game&lang=${locale}`);
  const ar=locale==='ar';
  await page.getByLabel(ar?'أدخل الجوائز':'Enter prizes').fill(ar?'هدية خاصة':'Special gift');
  await page.getByRole('switch').check();
  await page.getByRole('spinbutton', {name:ar?'مدة المؤقت':'Timer duration'}).fill('13');
  await page.getByRole('button',{name:ar?'بدء الفعالية':'Start event',exact:true}).click();
  await expect(page.getByRole('timer')).toHaveText('13');
  await expect(page.locator('#mg-winner-name')).not.toBeVisible();
  await page.getByRole('button',{name:ar?'اكشف سؤال':'Reveal Question',exact:true}).click();
  await expect(page.getByRole('timer')).toHaveText('13');
  await page.getByRole('button',{name:ar?'اكشف شرط':'Reveal Condition',exact:true}).click();
  await page.getByRole('button',{name:ar?'صحيحة':'Correct',exact:true}).click();
  const winnerDialog=page.getByRole('dialog',{name:ar?'تسجيل الفائز':'Register winner',exact:true});
  await expect(winnerDialog).toBeVisible();
  await expect(page.getByLabel(ar?'اسم الفائز':'Winner name',{exact:true})).toBeFocused();
  await page.getByLabel(ar?'اسم الفائز':'Winner name',{exact:true}).fill('Test Winner');
  await page.getByRole('button',{name:ar?'إضافة الفائز':'Add winner',exact:true}).click();
  await expect(winnerDialog).not.toBeVisible();
  await expect(page.locator('.mg-header h1')).toBeFocused();
  await page.screenshot({path:info.outputPath(`game-${locale}.png`),fullPage:true,animations:'disabled'});
  await page.getByRole('button',{name:ar?'صفحة الجوائز':'Prize page',exact:true}).click();
  await page.locator('.mg-winner-option').click();
  await page.locator('.mg-prize-card').click();
  await page.getByRole('button',{name:ar?'افتح جائزته!':'Open their prize!',exact:true}).click();
  await page.getByRole('button',{name:ar?'متابعة السحب':'Continue draw',exact:true}).click();
  await expect(page.locator('.mg-prize-card')).toContainText('Test Winner');
  await page.getByRole('button',{name:ar?'إنهاء الفعالية':'End event',exact:true}).click();
  await page.getByRole('button',{name:ar?'إنهاء وعرض النتائج':'End and view results',exact:true}).click();
  await expect(page.locator('.mg-results')).toContainText('Test Winner');
  await expect(page.locator('.mg-results')).not.toContainText('local-manual');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth+1)).toBeTruthy();
  await page.screenshot({path:info.outputPath(`closing-${locale}.png`),fullPage:true,animations:'disabled'});
});

test('reduced motion and retired participant route',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/?screen=game&legacyPreview=1');
  await expect(page.locator('.manual-game')).toBeVisible();
  await expect(page.locator('input[name*=participant], .participant')).toHaveCount(0);
  await page.getByRole('button',{name:'بدء الفعالية',exact:true}).click();
  const card=page.getByRole('button',{name:'اكشف سؤال',exact:true});
  await card.click();
  expect(await page.locator('.mg-flip-inner').first().evaluate(el=>getComputedStyle(el).transitionDuration)).toBe('0s');
});


test('direct buy CTA reports unavailable checkout without product modal or credit changes',async({page})=>{
 await page.route('**/api/auth?action=session', route=>route.fulfill({status:200,json:{code:'OK',data:{id:'host',displayName:'Host'}}}));
 await page.route('**/api/host',route=>route.fulfill({status:200,json:{code:'OK',data:{credits:0,events:[],products:[],contentVersions:[]}}}));
 let checkoutCalls=0;
 await page.route('**/api/checkout', route=>{checkoutCalls++;return route.fulfill({status:503,json:{code:'SANDBOX_CHECKOUT_NOT_CONFIGURED'}});});
 await page.goto('/?screen=events&lang=en');
 await expect(page.getByTestId('event-keys')).toContainText('0');
 await page.getByTestId('product-card-qc').click();
 await expect(page.locator('.platform-account-notice')).toContainText('Purchasing is currently unavailable');
 expect(checkoutCalls).toBe(1);
 await expect(page.getByRole('dialog')).not.toBeVisible();
 await expect(page.getByTestId('event-keys')).toContainText('0');
});

test('game fills short viewport without clipping controls',async({page})=>{
 await page.setViewportSize({width:375,height:667});
 await page.goto('/?screen=game');
 await page.getByRole('button',{name:'بدء الفعالية',exact:true}).click();
 const geometry=await page.locator('.manual-game').evaluate(el=>({height:el.getBoundingClientRect().height, viewport:innerHeight, minHeight:getComputedStyle(el).minHeight, display:getComputedStyle(el).display, classes:el.className}));
 expect(geometry.height).toBeGreaterThanOrEqual(geometry.viewport);
 await expect(page.getByRole('button',{name:'صفحة الجوائز',exact:true})).toBeInViewport();
});

test('event explanation preserves the dotted secondary button asset',async({page})=>{
  await page.goto('/?lang=ar');
  await page.getByTestId('nav-events').click();
  const secondary=page.getByTestId('event-how');
  await expect(secondary).toBeVisible();
  const image=await secondary.evaluate(el=>getComputedStyle(el).backgroundImage);
  expect(image).toContain('community-dots-secondary.svg');
  const response=await page.request.get('/assets/community-dots-secondary.svg');
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('image/svg+xml');
  expect((await response.body()).length).toBeGreaterThan(1000);
});

for (const locale of ['ar','en']) test(`homepage explanation and product discovery ${locale}`, async ({ page }) => {
  for (const size of [{width:320,height:568},{width:768,height:1024},{width:844,height:390},{width:1920,height:1080}]) {
    await page.setViewportSize(size);
    await page.goto(`/?lang=${locale}`);
    await expect(page.getByTestId('hero-how')).toHaveCount(0);
    await page.getByTestId('hero-explore').click();
    await page.getByTestId('event-how').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('.platform-how-steps li')).toHaveCount(3);
    for(let i=0;i<5;i++) { await page.keyboard.press('Tab'); expect(await dialog.evaluate(el=>el.contains(document.activeElement))).toBeTruthy(); }
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('event-how')).toBeFocused();
    await page.getByTestId('event-how').click();
    await expect(page.getByTestId('how-try')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('event-preview')).toBeVisible();
    await expect(page.locator('.manual-game')).toHaveCount(0);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBeTruthy();
  }
});

for (const locale of ['ar', 'en']) test(`homepage fits mobile viewport with touch navigation ${locale}`, async ({ browser }) => {
  const context = await browser.newContext({ hasTouch: true, isMobile: true });
  const page = await context.newPage();
  for (const size of [{width:320,height:568},{width:360,height:667},{width:390,height:844},{width:430,height:932},{width:844,height:390},{width:667,height:375},{width:568,height:320}]) {
    await page.setViewportSize(size);
    await page.goto(`/?lang=${locale}`);
    await page.evaluate(() => document.fonts.ready);
    await expect(page.getByTestId('hero-explore')).toBeInViewport({ratio:1});
    await expect(page.locator('.platform-footer')).toBeInViewport({ratio:1});
    expect(await page.evaluate(() => document.querySelector('.platform-footer')!.getBoundingClientRect().top - document.querySelector('[data-testid=hero-explore]')!.getBoundingClientRect().bottom)).toBeGreaterThan(8);
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1)).toBeTruthy();
    await expect(page.locator('.platform-nav-icon').first()).not.toBeVisible();
    await expect(page.locator('.platform-nav-label').first()).toBeVisible();
    await page.getByTestId('nav-events').tap();
    await expect(page.getByTestId('event-how')).toBeVisible();
  }
  await context.close();
});

test('desktop navigation flips on hover and keyboard focus, Discord uses official branding', async ({page}) => {
  await page.setViewportSize({width:1440,height:900});
  await page.goto('/?lang=ar');
  const nav = page.getByTestId('nav-events');
  await expect(nav.locator('.platform-nav-label')).toHaveCSS('opacity','0');
  await nav.hover();
  await expect(nav.locator('.platform-nav-label')).toHaveCSS('opacity','1');
  await expect(nav.locator('.platform-nav-icon')).toHaveCSS('opacity','0');
  await page.mouse.move(0,0); await page.keyboard.press('Tab'); await nav.focus();
  await expect(nav.locator('.platform-nav-label')).toHaveCSS('opacity','1');
  const login = page.getByRole('button',{name:'سجّل دخولك عبر Discord'});
  await expect(login).toHaveCSS('background-color','rgb(88, 101, 242)');
  await expect(login).toHaveCSS('color','rgb(255, 255, 255)');
  await expect(login.locator('img')).toHaveAttribute('src','/assets/discord-symbol-white.svg');
  await login.click();
  await expect(page).not.toHaveURL(/screen=host/);
  await expect(page.locator('.platform-account-notice')).toContainText('تعذر إتمام الطلب');
});

test('timer is optional and setup tooltips work with keyboard and touch', async ({page,browser}) => {
  await page.goto('/?screen=game&lang=ar');
  await expect(page.getByRole('spinbutton',{name:'مدة المؤقت'})).toHaveCount(0);
  await expect(page.getByRole('switch')).not.toBeChecked();
  const help = page.getByRole('button',{name:'توضيح الجوائز',exact:true});
  await help.focus();
  await expect(page.getByRole('tooltip')).toContainText('كل سطر غير فارغ');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  await page.getByRole('switch').focus(); await page.keyboard.press('Space');
  await expect(page.getByRole('spinbutton',{name:'مدة المؤقت'})).toBeVisible();
  await page.getByRole('spinbutton',{name:'مدة المؤقت'}).fill('13');
  await page.getByRole('switch').uncheck();
  await expect(page.getByRole('spinbutton',{name:'مدة المؤقت'})).toHaveCount(0);
  await page.getByRole('button',{name:'بدء الفعالية',exact:true}).click();
  await expect(page.getByRole('timer')).toHaveCount(0);
  const context = await browser.newContext({hasTouch:true,isMobile:true,viewport:{width:360,height:667}});
  const touch = await context.newPage(); await touch.goto('/?screen=game&lang=ar');
  const tip = touch.getByRole('button',{name:'توضيح الجوائز',exact:true});
  await tip.tap(); await expect(touch.getByRole('tooltip')).toContainText('الحد الأقصى للفائزين');
  await tip.tap(); await expect(touch.getByRole('tooltip')).toHaveCount(0);
  await tip.tap(); await touch.locator('h1').tap(); await expect(touch.getByRole('tooltip')).toHaveCount(0);
  await context.close();
});

test('attempt stepper respects limits, supports keyboard and configures the round', async ({page}) => {
  await page.goto('/?screen=game&lang=ar');
  const attempts=page.getByRole('spinbutton',{name:'المحاولات',exact:true});
  await expect(attempts).toHaveAttribute('aria-valuenow','1');
  await expect(page.getByRole('button',{name:'تقليل المحاولات'})).toBeDisabled();
  await page.getByRole('button',{name:'زيادة المحاولات'}).click();
  await page.getByRole('button',{name:'زيادة المحاولات'}).click();
  await expect(attempts).toHaveAttribute('aria-valuenow','3');
  await expect(page.getByRole('button',{name:'زيادة المحاولات'})).toBeDisabled();
  await attempts.focus(); await page.keyboard.press('ArrowDown');
  await expect(attempts).toHaveAttribute('aria-valuenow','2');
  await page.getByRole('button',{name:'بدء الفعالية',exact:true}).click();
  for(const name of ['اكشف سؤال','اكشف شرط','خاطئة']) await page.getByRole('button',{name,exact:true}).click();
  await expect(page.getByRole('button',{name:'اكشف سؤال',exact:true})).toBeEnabled();
});

test('artwork spans Home through the footer without opaque footer link boxes', async ({page}) => {
  for(const size of [{width:1243,height:845},{width:1440,height:900},{width:390,height:844}]) {
    await page.setViewportSize(size); await page.goto('/?lang=ar');
    const geometry=await page.locator('.platform-art').evaluate(el=>({art:el.getBoundingClientRect().bottom,root:el.parentElement!.getBoundingClientRect().bottom}));
    expect(Math.abs(geometry.art-geometry.root)).toBeLessThan(1);
    await expect(page.locator('.platform-footer-links button').first()).toHaveCSS('background-color','rgba(0, 0, 0, 0)');
  }
});
