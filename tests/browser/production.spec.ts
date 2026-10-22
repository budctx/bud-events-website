import { test, expect } from '@playwright/test';

const sizes = [ {width:1440,height:900}, {width:1366,height:768}, {width:390,height:844}, {width:375,height:667}, {width:360,height:800} ];
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
    for (const selector of ['.platform-login', '.platform-language', '[data-testid="nav-events"]', '[data-testid="hero-explore"]', '[data-testid="hero-how"]']) {
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
    await page.getByTestId('product-card-qc').click();
    const dialog=page.getByTestId('product-dialog');
    await expect(dialog).toBeVisible();
    await expect(page.getByTestId('product-try')).toBeVisible();
    for (let i=0;i<8;i++) { await page.keyboard.press('Tab'); expect(await dialog.evaluate(el=>el.contains(document.activeElement))).toBeTruthy(); }
    await page.keyboard.press('Shift+Tab');
    expect(await dialog.evaluate(el=>el.contains(document.activeElement))).toBeTruthy();
    await page.screenshot({path:info.outputPath(`modal-${locale}-${size.width}.png`),fullPage:true,animations:'disabled'});
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(page.getByTestId('product-card-qc')).toBeFocused();
    await page.getByTestId('nav-bots').click();
    await expect(page.getByTestId('platform-root')).toContainText(locale==='ar'?'قريبًا':'Coming soon');
    expect(errors).toEqual([]);
  });
}

for(const locale of ['ar','en']) test(`manual journey ${locale}`,async({page},info)=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto(`/?screen=game&lang=${locale}`);
  const ar=locale==='ar';
  await page.getByLabel(ar?'أدخل الجوائز (كل سطر جائزة)':'Enter prizes (one per line)').fill(ar?'هدية خاصة':'Special gift');
  await page.getByRole('spinbutton').fill('13');
  await page.getByRole('checkbox').check();
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


test('buy CTA reports unavailable integration without pretending payment succeeded',async({page})=>{
 await page.goto('/?lang=en');
 await page.getByTestId('nav-events').click();
 // Navigation deliberately focuses main on the next animation frame.
 // Wait for that handoff before testing keyboard activation of the product.
 await expect(page.locator('#platform-content')).toBeFocused();
 const trigger=page.getByTestId('product-card-qc');
 await trigger.focus(); await page.keyboard.press('Enter');
 await expect(page.getByTestId('product-dialog')).toBeVisible();
 await page.getByTestId('product-buy').click();
 await expect(page.getByRole('status')).toContainText('Purchasing is currently unavailable');
 await page.keyboard.press('Escape');
 await expect(trigger).toBeFocused();
});


test('game fills short viewport without clipping controls',async({page})=>{
 await page.setViewportSize({width:375,height:667});
 await page.goto('/?screen=game');
 await page.getByRole('button',{name:'بدء الفعالية',exact:true}).click();
 const geometry=await page.locator('.manual-game').evaluate(el=>({height:el.getBoundingClientRect().height, viewport:innerHeight, minHeight:getComputedStyle(el).minHeight, display:getComputedStyle(el).display, classes:el.className}));
 expect(geometry.height).toBeGreaterThanOrEqual(geometry.viewport);
 await expect(page.getByRole('button',{name:'صفحة الجوائز',exact:true})).toBeInViewport();
});

test('approved Figma dotted secondary button asset is served and applied',async({page})=>{
  await page.goto('/?lang=ar');
  const secondary=page.locator('.platform-hero-actions .platform-action-secondary');
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
    await page.getByTestId('hero-how').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('.platform-how-steps li')).toHaveCount(3);
    for(let i=0;i<5;i++) { await page.keyboard.press('Tab'); expect(await dialog.evaluate(el=>el.contains(document.activeElement))).toBeTruthy(); }
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('hero-how')).toBeFocused();
    await page.getByTestId('hero-how').click();
    await page.getByTestId('how-explore').click();
    await expect(page.getByTestId('product-card-qc')).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBeTruthy();
  }
});
