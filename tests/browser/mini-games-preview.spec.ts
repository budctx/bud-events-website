import {expect,test} from '@playwright/test';
test('six-game preview runs with zero prizes and never requests a paid start',async({page})=>{
 const requests:string[]=[];
 page.on('request',r=>{if(r.url().includes('/api/host')||r.url().includes('/api/checkout'))requests.push(r.url());});
 await page.goto('/?screen=mini-preview');
 await expect(page.getByRole('heading',{name:'ميني قيمز'})).toBeVisible();
 await page.getByLabel('الجوائز (اختياري، كل سطر جائزة)').fill('');
 await page.getByRole('button',{name:/بدء المعاينة/}).click();
 await expect(page.locator('.mini-hub-card')).toHaveCount(6);
 await expect(page.getByText('لا توجد جوائز مجهّزة',{exact:false}).first()).toBeVisible();
 await page.getByRole('button',{name:'القنبلة',exact:true}).click();
 await page.getByRole('dialog',{name:'القنبلة'}).getByRole('button',{name:'بدء اللعبة'}).click();
 for(let i=0;i<25;i++){
  if(await page.getByText(/خسر اللاعب/).isVisible())break;
  await page.locator('.mini-bomb-cell:not(.is-open)').first().click();
 }
 await expect(page.getByText(/خسر اللاعب/)).toBeVisible();
 await expect(page.getByText('لا توجد جوائز مجهّزة',{exact:false}).last()).toBeVisible();
 await page.getByRole('button',{name:'إنهاء اللعبة دون فائز'}).click();
 await expect(page.locator('.mini-hub-card')).toHaveCount(6);
 await page.getByRole('button',{name:/الجوائز/}).first().click();
 await expect(page.getByText('لا توجد جوائز في هذه الفعالية')).toBeVisible();
 await page.getByRole('button',{name:/الختام/}).last().click();
 await expect(page.getByRole('heading',{name:'شكرًا لمشاركتكم!'})).toBeVisible();
 expect(requests).toEqual([]);
});
test('wheel stops category before letter, reshuffles and never shows excluded letters',async({page})=>{
 await page.clock.install();
 await page.goto('/?screen=mini-preview');
 await page.getByRole('button',{name:/بدء المعاينة/}).click();
 await page.getByRole('button',{name:'عجلة الحروف',exact:true}).click();
 await page.getByRole('button',{name:'بدء اللعبة'}).click();
 const modal=page.getByRole('dialog',{name:'عجلة الحروف'});
 await expect(modal.locator('.mini-wheel-reel strong')).toHaveCount(0);
 await page.clock.runFor(4000);
 await expect(modal.locator('.mini-wheel-reel strong')).toHaveCount(0);
 await modal.getByRole('button',{name:'سحب المقبض'}).click();
 await page.clock.runFor(2700);
 await expect(modal.locator('.mini-wheel-reel strong')).toHaveCount(1);
 await page.clock.runFor(1300);
 await expect(modal.locator('.mini-wheel-reel strong')).toHaveCount(2);
 const letter=await modal.locator('.mini-wheel-reel strong').last().textContent();
 expect(letter).not.toMatch(/[ثذضظ]/);
 await modal.getByRole('button',{name:'إعادة السحب'}).click();
 await expect(modal.locator('.mini-wheel-reel strong')).toHaveCount(0);
});
test('responsive mini-game hub has usable modals and no horizontal page overflow',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/?screen=mini-preview');
 await page.getByRole('button',{name:/بدء المعاينة/}).click();
 await expect(page.locator('.mini-hub-card')).toHaveCount(6);
 await page.getByRole('button',{name:'ذاكرة الإيموجي',exact:true}).click();
 await expect(page.getByRole('dialog',{name:'ذاكرة الإيموجي'})).toBeVisible();
 await page.getByRole('button',{name:'بدء اللعبة'}).click();
 await expect(page.locator('.mini-emoji-cell')).toHaveCount(10);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await page.keyboard.press('Escape');
 await expect(page.getByText('لم يتم تحديد فائز، هل أنت متأكد؟')).toBeVisible();
 await page.getByRole('button',{name:'إنهاء بدون فائز'}).click();
 await expect(page.locator('.mini-hub-card')).toHaveCount(6);
});

// The second event card is browsable even before signing in; a paid start still requires an approved host.
test('Mini Games product can be discovered before Discord login',async({page})=>{
 await page.route('**/api/auth?action=session',route=>route.fulfill({status:401,json:{code:'AUTH_REQUIRED'}}));
 await page.goto('/events');
 await expect(page.getByTestId('product-card-mini')).toHaveCount(1);
 await page.getByRole('button',{name:'عرض فعالية ميني قيمز'}).click();
 await expect(page.getByTestId('product-card-mini').getByRole('heading',{name:'ميني قيمز'})).toBeVisible();
 await expect(page.getByTestId('event-mini-setup')).toHaveCount(0);
 await expect(page.getByTestId('product-card-mini-buy')).toHaveCount(1);
});

test('all six cards offer independent info dialogs and default-collapsed setup options',async({page})=>{
 await page.goto('/?screen=mini-preview');await page.getByRole('button',{name:/بدء المعاينة/}).click();
 await expect(page.locator('.mini-hub-card')).toHaveCount(6);
 await expect(page.locator('.mini-hub-info')).toHaveCount(6);
 await page.getByRole('button',{name:'شرح القنبلة'}).click();
 const help=page.getByRole('dialog',{name:'شرح القنبلة'});
 await expect(help).toBeVisible();
 await expect(help).toContainText('سيُضاف شرح اللعبة هنا لاحقًا.');
 await expect(page.locator('.mini-bomb-cell')).toHaveCount(0);
 await help.getByRole('button',{name:'إغلاق الشرح'}).click();
 await page.getByRole('button',{name:'ذاكرة الإيموجي',exact:true}).click();
 const setup=page.getByRole('dialog',{name:'ذاكرة الإيموجي'});
 await expect(setup.locator('details')).not.toHaveAttribute('open',/.+/);
 await expect(setup.getByRole('button',{name:'بدء اللعبة'})).toBeVisible();
 await setup.locator('summary').click();
 await expect(setup.getByRole('button',{name:'5 أزواج'})).toBeVisible();
 await expect(setup.getByRole('button',{name:'7 أزواج'})).toBeVisible();
 await expect(setup.getByRole('button',{name:'3 أزواج'})).toHaveCount(0);
});
test('new bomb and emoji boards stay numbered square and have balanced rows',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/?screen=mini-preview');await page.getByRole('button',{name:/بدء المعاينة/}).click();
 await page.getByRole('button',{name:'القنبلة',exact:true}).click();
 const bomb=page.getByRole('dialog',{name:'القنبلة'});
 await expect(bomb.locator('.mini-chips')).toHaveCount(0);
 await bomb.getByRole('button',{name:'بدء اللعبة'}).click();
 await expect(bomb.locator('.mini-bomb-cell')).toHaveCount(16);
 await expect(bomb.locator('.mini-bomb-cell').first()).toHaveText('1');
 await expect(bomb.locator('.mini-bomb-cell').last()).toHaveText('16');
 await bomb.getByRole('button',{name:'إغلاق اللعبة'}).click();
 await bomb.getByRole('button',{name:'إنهاء بدون فائز'}).click();
 for(const [pairs,total] of [[5,10],[7,14]] as const){
  await page.getByRole('button',{name:'ذاكرة الإيموجي',exact:true}).click();
  const modal=page.getByRole('dialog',{name:'ذاكرة الإيموجي'});
  await modal.locator('summary').click();
  await modal.getByRole('button',{name:pairs+' أزواج'}).click();
  await modal.getByRole('button',{name:'بدء اللعبة'}).click();
  await expect(modal.locator('.mini-emoji-cell')).toHaveCount(total);
  const measures=await modal.locator('.mini-emoji-cell').evaluateAll(nodes=>nodes.map(n=>({width:n.getBoundingClientRect().width,height:n.getBoundingClientRect().height,top:Math.round(n.getBoundingClientRect().top)})));
  expect(measures.every(m=>Math.abs(m.width-m.height)<1)).toBe(true);
  expect(new Set(measures.map(m=>m.top)).size).toBe(2);
  await expect(modal.locator('.mini-emoji-cell').first()).toHaveText('1');
  await modal.getByRole('button',{name:'إغلاق اللعبة'}).click();
  await modal.getByRole('button',{name:'إنهاء بدون فائز'}).click();
 }
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});
test('five-step pattern illuminates its four unlettered pads silently and then enables input',async({page})=>{
 await page.clock.install();await page.goto('/?screen=mini-preview');await page.getByRole('button',{name:/بدء المعاينة/}).click();
 await page.getByRole('button',{name:'احفظ النمط',exact:true}).click();
 const modal=page.getByRole('dialog',{name:'احفظ النمط'});
 await expect(modal.locator('.mini-chips')).toHaveCount(0);
 await page.clock.pauseAt(1000000); // Freeze time across async assertions; advance deterministically with runFor.
 await modal.getByRole('button',{name:'بدء اللعبة'}).click();
 const pads=modal.locator('.mini-pattern-pad');
 await expect(pads).toHaveCount(4);
 await expect(pads.first()).toHaveText('');
 await expect(modal.locator('.mini-pattern-turn')).toContainText('5');
 await expect(pads.first()).toBeDisabled();
 await page.clock.runFor(600);
 await expect(modal.locator('.mini-pattern-pad.is-lit')).toHaveCount(1);
 await page.clock.runFor(450);
 await expect(modal.locator('.mini-pattern-pad.is-lit')).toHaveCount(0); // Includes repeated consecutive colors.
 await page.clock.runFor(250);
 await expect(modal.locator('.mini-pattern-pad.is-lit')).toHaveCount(1);
 await page.clock.runFor(3200);
 await expect(pads.first()).toBeEnabled();
 await expect(modal.locator('button[aria-label="تفعيل الصوت"],button[aria-label="كتم الصوت"]')).toHaveCount(0);
});
