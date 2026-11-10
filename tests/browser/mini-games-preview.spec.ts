import {expect,test} from '@playwright/test';
test('six-game preview runs with zero prizes and never requests a paid start',async({page})=>{
 await page.setViewportSize({width:390,height:844});
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
 const resultLayer=page.locator('.mini-result-layer'),resultDialog=page.getByRole('dialog',{name:'القنبلة'});
 await expect(resultLayer).toBeVisible();
 const resultGeometry=await page.evaluate(()=>{const layer=document.querySelector('.mini-result-layer')!.getBoundingClientRect();return {covers:Math.abs(layer.left)<=3&&Math.abs(layer.right-innerWidth)<=3&&Math.abs(layer.top)<=3&&Math.abs(layer.bottom-innerHeight)<=3,buttons:[...document.querySelectorAll('.mini-result-layer button')].every(node=>{const box=node.getBoundingClientRect();return box.top>=0&&box.bottom<=innerHeight;})};});
 expect(resultGeometry).toEqual({covers:true,buttons:true});
 await expect(resultDialog.getByRole('button',{name:'تسجيل فائز'})).toHaveCount(0);
 await page.getByRole('button',{name:'إنهاء اللعبة دون فائز'}).click();
 await expect(page.locator('.mini-hub-card')).toHaveCount(6);
 await page.getByRole('button',{name:/الجوائز/}).first().click();
 await expect(page.getByText('لا توجد جوائز مسجلة.')).toBeVisible();
 await page.getByRole('button',{name:'انهاء'}).click();
 await expect(page.getByRole('dialog',{name:'إنهاء الفعالية؟'})).toBeVisible();
 await page.getByRole('button',{name:'إنهاء وعرض النتائج'}).click();
 await expect(page.getByRole('heading',{name:'شكرًا لكم على المشاركة'})).toBeVisible();
 expect(requests).toEqual([]);
});
for(const width of [390,1440]){
 test(`wheel reveals both results before inline host choices, never covering the reels ${width}`,async({page},info)=>{
  await page.setViewportSize({width,height:width===390?844:900});
  await page.clock.install();
  await page.goto('/?screen=mini-preview');
  await page.getByRole('button',{name:/بدء المعاينة/}).click();
  await page.getByRole('button',{name:'عجلة الحروف',exact:true}).click();
  await page.getByRole('button',{name:'بدء اللعبة'}).click();
  const modal=page.getByRole('dialog',{name:'عجلة الحروف'});
  await expect(modal.locator('.mini-wheel-reel strong')).toHaveCount(0);
  await page.clock.runFor(4000); // Idle until the host actually pulls.
  await expect(modal.locator('.mini-wheel-reel strong')).toHaveCount(0);
  const lever=modal.getByRole('button',{name:'سحب المقبض'});
  await expect(lever.locator('.mini-wheel-lever-handle')).toHaveCount(1);
  await expect(lever.locator('.mini-wheel-lever-handle')).toHaveCSS('background-image',/gradient/);
  await lever.click();
  await expect(modal.locator('.mini-wheel-lever')).toHaveClass(/is-spinning/);
  await page.clock.runFor(2700);
  await expect(modal.locator('.mini-wheel-reel strong')).toHaveCount(1);
  await expect(modal.locator('.mini-wheel-readout')).toHaveCount(0);
  await expect(modal.locator('.mini-wheel-actions')).toHaveCount(0);
  await page.clock.runFor(1000);
  await expect(modal.locator('.mini-wheel-reel strong')).toHaveCount(1);
  await expect(modal.locator('.mini-result-layer')).toHaveCount(0);
  await page.clock.runFor(300);
  await expect(modal.locator('.mini-wheel-reel strong')).toHaveCount(2);
  await expect(modal.locator('.mini-wheel-readout')).toBeVisible();
  const letter=await modal.locator('.mini-wheel-reel strong').last().textContent();
  expect(letter).not.toMatch(/[ثذضظ]/);
  await expect(modal.locator('.mini-result-layer')).toHaveCount(0);
  await expect(modal.locator('.mini-wheel-actions')).toHaveCount(0);
  // The result must remain uncovered for 2.4 seconds after the letter settles.
  await page.clock.runFor(2000);
  await expect(modal.locator('.mini-wheel-actions')).toHaveCount(0);
  await page.clock.runFor(300);
  await expect(modal.locator('.mini-wheel-actions')).toBeVisible();
  await expect(modal.locator('.mini-wheel-readout')).toBeVisible();
  await expect(modal.locator('.mini-wheel-actions').getByRole('button',{name:'تسجيل فائز'})).toBeVisible();
  await expect(modal.locator('.mini-wheel-actions').getByRole('button',{name:'إنهاء اللعبة دون فائز'})).toBeVisible();
  await expect(modal.getByText('اكتملت اللعبة',{exact:true})).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.screenshot({path:info.outputPath('wheel-result-uncovered-'+width+'.png'),animations:'disabled'});
  await modal.getByRole('button',{name:'إعادة السحب'}).click();
  await expect(modal.locator('.mini-wheel-actions')).toHaveCount(0);
  await expect(modal.locator('.mini-wheel-readout')).toHaveCount(0);
  await page.clock.runFor(4000);
  await expect(modal.locator('.mini-wheel-readout')).toBeVisible();
  await expect(modal.locator('.mini-result-layer')).toHaveCount(0);
 });
}
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
 await page.clock.pauseAt(Date.now()+60000); // Pause strictly in the future, never behind the installed browser clock.
 await modal.getByRole('button',{name:'بدء اللعبة'}).click();
 const pads=modal.locator('.mini-pattern-pad');
 await expect(pads).toHaveCount(4);
 await expect(pads.first()).toHaveText('');
 await expect(modal.locator('.mini-pattern-turn')).toContainText('شاهد الأضواء'); // Sequence length 5 is asserted by the engine tests; no redundant onscreen text.
 await expect(pads.first()).toBeDisabled();
 await page.clock.runFor(600);
 await expect(modal.locator('.mini-pattern-pad.is-lit')).toHaveCount(1);
 // The UI ticks every 120 ms. Observe the dark gap well away from either edge.
 await page.clock.runFor(520);
 await expect(modal.locator('.mini-pattern-pad.is-lit')).toHaveCount(0); // Distinct flashes even when a color repeats.
 await page.clock.runFor(250);
 await expect(modal.locator('.mini-pattern-pad.is-lit')).toHaveCount(1);
 await page.clock.runFor(3100);
 await expect(pads.first()).toBeEnabled();
 await expect(modal.locator('button[aria-label="تفعيل الصوت"],button[aria-label="كتم الصوت"]')).toHaveCount(0);
});

test('saving a winner restores game focus and the shared prize stage assigns and locks a reveal',async({page})=>{
 const button=(name:string)=>page.getByRole('button',{name,exact:true});
 await page.goto('/?screen=mini-preview');
 await button('بدء المعاينة').click();
 const scramble=button('الكلمة المبعثرة');
 await scramble.click();
 await button('بدء اللعبة').click();
 await button('إنهاء التحدي').click();
 await button('تسجيل فائز').click();
 await page.getByRole('textbox',{name:'اسم الفائز'}).fill('مختبر');
 await button('حفظ الفائز').click();
 await expect(scramble).toBeFocused();

 await button('الجوائز').click();
 await expect(page.locator('[data-event-section="shared-prizes"]')).toBeVisible();
 const prize=button('فتح الجائزة 1');
 await expect(prize).toBeDisabled();
 await expect(button('عودة')).toBeEnabled();
 await button('1 مختبر بانتظار الجائزة').click();
 await expect(prize).toBeEnabled();
 await prize.click();
 await expect(page.getByRole('dialog',{name:'نتيجة الجائزة'})).toBeVisible();
 await page.keyboard.press('Escape');
 await expect(button('عودة')).toBeDisabled();
});

test('Mini Games winner management matches the shared event journey, including duplicate records, prizes and read-only closing',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/?screen=mini-preview');
 await page.getByRole('button',{name:/بدء المعاينة/}).click();
 const headerWinners=page.getByRole('button',{name:/^الفائزون/});
 await headerWinners.click();
 const manager=page.getByRole('dialog',{name:'الفائزون'});
 await expect(manager).toBeVisible();
 await expect(manager).toContainText('لا يوجد فائزون بعد');
 await manager.getByRole('button',{name:'إضافة فائز'}).click();
 await manager.getByRole('textbox',{name:'اسم الفائز'}).fill('سارة');
 await manager.getByRole('button',{name:'إضافة فائز'}).click();
 await expect(manager.locator('.mg-winner-row')).toHaveCount(1);
 await manager.getByRole('button',{name:'إضافة فائز'}).click();
 await manager.getByRole('textbox',{name:'اسم الفائز'}).fill('سارة');
 await expect(manager).toContainText('الاسم مسجل سابقًا');
 await manager.getByRole('button',{name:'إضافة فائز'}).click();
 await expect(manager.locator('.mg-winner-row')).toHaveCount(2);
 await expect(manager.locator('[data-winner-id="winner-2"]')).toContainText('سارة');
 await manager.getByRole('button',{name:'تعديل سارة #2'}).click();
 await manager.getByRole('textbox',{name:/تعديل اسم الفائز/}).fill('نورة');
 await manager.getByRole('button',{name:'حفظ',exact:true}).click();
 await expect(manager.locator('[data-winner-id="winner-2"]')).toContainText('نورة');
 await manager.getByRole('button',{name:'إغلاق'}).click();
 await expect(manager).not.toBeVisible();
 await expect(headerWinners).toContainText('2/3');
 await page.getByRole('button',{name:'الجوائز',exact:true}).click();
 await page.locator('.mg-winner-option').first().click();
 await page.getByRole('button',{name:'فتح الجائزة 1'}).click();
 await expect(page.getByRole('dialog',{name:'نتيجة الجائزة'})).toBeVisible();
 await page.keyboard.press('Escape');
 await expect(page.locator('.mg-prize-card').first()).toHaveAttribute('data-revealed','true');
 await headerWinners.click();
 await manager.getByRole('button',{name:'حذف سارة #1'}).click();
 await expect(manager).toContainText('ستُعاد جائزته إلى البطاقات المتاحة للسحب');
 await manager.getByRole('button',{name:'تأكيد الحذف'}).click();
 await expect(manager.locator('[data-winner-id="winner-1"]')).toHaveCount(0);
 await manager.getByRole('button',{name:'إغلاق'}).click();
 await expect(page.locator('.mg-prize-card').first()).toHaveAttribute('data-revealed','false');
 await page.getByRole('button',{name:'انهاء'}).click();
 await page.getByRole('button',{name:'إنهاء وعرض النتائج'}).click();
 await headerWinners.click();
 await expect(manager).toBeVisible();
 await expect(manager.locator('.mg-winner-tools')).toHaveCount(0);
 await expect(manager.getByRole('button',{name:'إضافة فائز'})).toHaveCount(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});



/** Regression: winner-management title, trophy, + action and close must never overlap. */
async function expectManagementHeaderClear(page:import('@playwright/test').Page){
 const dialog=page.locator('dialog.mg-management');
 await expect(dialog).toBeVisible();
 const data=await dialog.evaluate(node=>{
  const selectors=[':scope > h2',':scope > .mg-management-heading',':scope > .mg-dialog-close'];
  const parts=selectors.map(s=>node.querySelector<HTMLElement>(s)?.getBoundingClientRect());
  const bound=node.getBoundingClientRect();
  const overlap=(a:DOMRect,b:DOMRect)=>Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left))*Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));
  return {present:parts.every(Boolean),
   overlapping:parts.some((a,i)=>!!a&&parts.some((b,j)=>j>i&&!!b&&overlap(a,b)>1)),
   inside:parts.every(p=>!!p&&p.left>=bound.left-1&&p.right<=bound.right+1&&p.top>=bound.top-1&&p.bottom<=bound.bottom+1),
   horizontalOverflow:document.documentElement.scrollWidth>innerWidth+1
  };
 });
 expect(data).toEqual({present:true,overlapping:false,inside:true,horizontalOverflow:false});
}

test('Mini Games winner manager heading stays clear at mobile and desktop widths',async({page},info)=>{
 await page.goto('/?screen=mini-preview');
 await page.getByRole('button',{name:/بدء المعاينة/}).click();
 await page.getByRole('button',{name:/^الفائزون/}).click();
 for(const width of [320,390,1440]){
  await page.setViewportSize({width,height:width===1440?900:844});
  await expectManagementHeaderClear(page);
  if(width===390)await page.screenshot({path:info.outputPath('mini-winners-header-390.png')});
 }
});


test('Mini Games activity, prizes and closing hide decorative stage tabs and preserve host controls',async({page},info)=>{
 for(const width of [390,1440]){
  await page.setViewportSize({width,height:width===1440?900:844});
  await page.goto('/?screen=mini-preview');
  const tabs=page.locator('.bud-steps, .event-journey-steps');
  await expect(tabs).toHaveCount(0);
  await page.getByLabel('الجوائز (اختياري، كل سطر جائزة)').fill('');
  await page.getByRole('button',{name:/بدء المعاينة/}).click();
  await expect(page.getByRole('heading',{name:'اختر لعبتك'})).toBeVisible();
  await expect(page.locator('.mini-hub-card')).toHaveCount(6);
  await expect(tabs).toHaveCount(0);
  await expect(page.getByRole('button',{name:/^الفائزون/})).toBeVisible();
  await expect(page.locator('.event-journey-prizes')).toBeVisible();
  await page.locator('.event-journey-prizes').click();
  await expect(page.getByText('لا توجد جوائز مسجلة.')).toBeVisible();
  await expect(tabs).toHaveCount(0);
  await page.getByRole('button',{name:'انهاء'}).click();
  await page.getByRole('button',{name:'إنهاء وعرض النتائج'}).click();
  await expect(page.getByRole('heading',{name:'شكرًا لكم على المشاركة'})).toBeVisible();
  await expect(tabs).toHaveCount(0);
  await expect(page.getByRole('button',{name:'نسخ النتائج'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.screenshot({path:info.outputPath('mini-no-stage-tabs-'+width+'.png'),animations:'disabled'});
 }
});
