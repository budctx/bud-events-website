import { test, expect } from '@playwright/test';

for (const lang of ['ar','en'] as const) {
  for (const viewport of [
    {width:360,height:800}, {width:375,height:667},
    {width:390,height:844}, {width:1366,height:768},
    {width:1440,height:900}
  ]) {
    test('platform bounds '+lang+' '+viewport.width+'x'+viewport.height, async ({page}) => {
      await page.setViewportSize(viewport);
      await page.goto('/?screen=site&lang='+lang);
      await expect(page.locator('.platform-shell')).toBeVisible();
      await expect(page.locator('html')).toHaveAttribute('dir',lang==='ar'?'rtl':'ltr');
      const state=await page.evaluate(() => {
        const bounds=['.platform-header','.platform-main','.platform-footer','.platform-hero-copy','.platform-actions','.platform-art']
          .map(s=>{const r=document.querySelector(s)?.getBoundingClientRect();return {s,fit:!!r&&r.top>=-1&&r.left>=-1&&r.bottom<=innerHeight+1&&r.right<=innerWidth+1};});
        return {fitWidth:document.documentElement.scrollWidth<=innerWidth,
          fitHeight:document.documentElement.scrollHeight<=innerHeight,bounds};
      });
      expect(state.fitWidth).toBeTruthy();
      expect(state.fitHeight).toBeTruthy();
      for(const b of state.bounds) expect(b.fit,b.s).toBeTruthy();
    });
  }
}
test('balanced bilingual home, product navigation and preview links',async ({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/?screen=site&lang=ar');
  await expect(page.locator('.platform-portal-card')).toHaveCount(3);
  await expect(page.locator('.platform-hero')).not.toContainText('سؤال وشرط');
  await page.getByRole('button',{name:'تصفح أقسام بُعد'}).click();
  await expect(page.locator('.platform-portal-card').first()).toBeFocused();
  await page.getByRole('button',{name:'تصفح الفعاليات'}).click();
  await expect(page.locator('.platform-main')).toHaveAttribute('data-section','events');
  await expect(page.getByRole('link',{name:'جرّب سؤال وشرط'})).toHaveAttribute('href','/?lang=ar');
  await page.getByRole('button',{name:'البوتات',exact:true}).click();
  await expect(page.getByText('تكاملات الدسكورد قيد التطوير')).toBeVisible();
  await page.getByRole('button',{name:'Switch to English'}).click();
  await expect(page.locator('html')).toHaveAttribute('dir','ltr');
  await page.getByRole('button',{name:'Designs',exact:true}).click();
  await expect(page.getByText('Collection in preparation')).toBeVisible();
});
test('reduced motion and keyboard',async ({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/?screen=site&lang=en');
  await expect(page.getByRole('link',{name:'Skip to content'})).toHaveCount(1);
  const duration=await page.locator('.platform-stage').evaluate(el=>getComputedStyle(el).animationDuration);
  expect(duration).toMatch(/^(0s|0ms|0\.0+s)$/);
  await page.getByRole('button',{name:'Explore BU’D products'}).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.platform-portal-card').first()).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('.platform-main')).toHaveAttribute('data-section','events');
});
