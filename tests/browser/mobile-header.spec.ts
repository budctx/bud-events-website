import {test,expect} from '@playwright/test';
const widths=[320,360,375,390,430];
for(const width of widths)for(const signedIn of [false,true]){
 test('thumb friendly RTL header '+width+' '+(signedIn?'signed-in':'guest'),async({page},info)=>{
  await page.setViewportSize({width,height:width===320?568:844});
  if(signedIn){
   await page.route('**/api/auth?action=session',r=>r.fulfill({json:{code:'OK',data:{id:'11111111-1111-4111-8111-111111111111',displayName:'حساب طويل على Discord'}}}));
   await page.route('**/api/host',r=>r.fulfill({json:{code:'OK',data:{credits:2,events:[],products:[],contentVersions:[]}}}));
  }
  await page.goto('/?screen=events&lang=ar');
  const logo=page.getByRole('button',{name:'بُعد — الرئيسية'});
  const toggle=page.locator('.platform-mobile-menu-toggle');
  const account=signedIn?page.locator('.platform-account-trigger'):page.getByRole('button',{name:'سجّل دخولك عبر Discord'});
  await expect(logo).toBeVisible();await expect(toggle).toBeVisible();await expect(account).toBeVisible();
  const logoBox=await logo.boundingBox(),toggleBox=await toggle.boundingBox(),accountBox=await account.boundingBox();
  expect(Math.abs(logoBox!.x+logoBox!.width/2-width/2)).toBeLessThanOrEqual(2);
  expect(toggleBox!.x).toBeGreaterThan(logoBox!.x+logoBox!.width);
  expect(accountBox!.x+accountBox!.width).toBeLessThan(logoBox!.x);
  expect(toggleBox!.height).toBeGreaterThanOrEqual(44);
  expect(accountBox!.height).toBeGreaterThanOrEqual(44);
  await toggle.click();
  const sheet=page.getByRole('dialog',{name:'قائمة التنقل'});
  await expect(sheet).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-expanded','true');
  await expect(sheet.getByTestId('nav-events')).toHaveAttribute('aria-current','page');
  await expect(sheet.getByRole('button',{name:'المساعدة والسياسات'})).toBeVisible();
  const panel=await sheet.boundingBox();
  expect(panel!.x+panel!.width).toBeGreaterThanOrEqual(width-16); // Chromium RTL scrollbar gutter
  expect(panel!.width).toBeLessThan(width);
  const foot=await sheet.getByRole('button',{name:'المساعدة والسياسات'}).boundingBox();
  expect(foot!.y+foot!.height).toBeGreaterThan(0.57*(width===320?568:844));
  expect(await page.evaluate(()=>document.body.style.overflow)).toBe('hidden');
  expect(await page.evaluate(()=>document.querySelector('dialog')!.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(sheet).not.toBeVisible();
  await expect(toggle).toBeFocused();
  expect(await page.evaluate(()=>document.body.style.overflow)).not.toBe('hidden');
  await page.screenshot({path:info.outputPath('thumb-header-'+width+'-'+(signedIn?'account':'guest')+'.png'),animations:'disabled'});
  await toggle.click();
  await sheet.getByRole('button',{name:'المساعدة والسياسات'}).click();
  await expect(page.getByRole('heading',{name:'مركز المساعدة والسياسات'})).toBeVisible();
  await expect(sheet).not.toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 });
}
test('mobile Sheet closes on backdrop tap and supports keyboard focus trap',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/');
 const button=page.getByRole('button',{name:'فتح قائمة التنقل'});
 await button.click();const sheet=page.getByRole('dialog',{name:'قائمة التنقل'});
 await expect(sheet).toBeVisible();
 await sheet.getByRole('button',{name:'إغلاق قائمة التنقل'}).focus();
 await page.keyboard.press('Shift+Tab');
 expect(await page.evaluate(()=>document.querySelector('dialog')!.contains(document.activeElement))).toBe(true);
 const rect=await sheet.boundingBox();
 await page.mouse.click(rect!.x-3,200); // hit the backdrop rather than the scrollbar gutter
 await expect(sheet).not.toBeVisible();await expect(button).toBeFocused();
});
test('mobile Sheet mirrors its start edge under LTR direction',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/');
 await page.evaluate(()=>{document.querySelector('.platform')!.setAttribute('dir','ltr');document.getElementById('platform-mobile-sheet')!.setAttribute('dir','ltr');});
 const logo=await page.getByRole('button',{name:'بُعد — الرئيسية'}).boundingBox();
 const toggle=await page.getByRole('button',{name:'فتح قائمة التنقل'}).boundingBox();
 const account=await page.getByRole('button',{name:'سجّل دخولك عبر Discord'}).boundingBox();
 expect(toggle!.x+toggle!.width).toBeLessThan(logo!.x);
 expect(account!.x).toBeGreaterThan(logo!.x+logo!.width);
 await page.getByRole('button',{name:'فتح قائمة التنقل'}).click();
 const sheet=await page.getByRole('dialog',{name:'قائمة التنقل'}).boundingBox();
 expect(sheet!.x).toBeLessThanOrEqual(16); // reserved Chromium scrollbar gutter
});
