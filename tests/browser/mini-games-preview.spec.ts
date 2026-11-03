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
 await page.getByRole('dialog',{name:'القنبلة'}).getByRole('button',{name:/بدء القنبلة/}).click();
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
 await page.getByRole('button',{name:/بدء عجلة الحروف/}).click();
 const modal=page.getByRole('dialog',{name:'عجلة الحروف'});
 await expect(modal.locator('.mini-wheel-reel strong')).toHaveCount(0);
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
 await page.getByRole('button',{name:/بدء ذاكرة الإيموجي/}).click();
 await expect(page.locator('.mini-emoji-cell')).toHaveCount(10);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await page.keyboard.press('Escape');
 await expect(page.getByText('لم يتم تحديد فائز، هل أنت متأكد؟')).toBeVisible();
 await page.getByRole('button',{name:'إنهاء بدون فائز'}).click();
 await expect(page.locator('.mini-hub-card')).toHaveCount(6);
});
