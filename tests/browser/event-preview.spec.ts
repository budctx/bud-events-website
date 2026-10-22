import { test, expect } from '@playwright/test';
import { readdirSync, readFileSync } from 'node:fs';

test.use({baseURL:'http://127.0.0.1:4175'});

for(const locale of ['ar','en']) for(const size of [{width:1440,height:900},{width:390,height:844},{width:320,height:568}]) {
  test(`production fixed cards and five-second countdown ${locale} ${size.width}`,async({page},info)=>{
    const ar=locale==='ar'; await page.setViewportSize(size);
    await page.clock.install();
    await page.goto(`/?lang=${locale}`); await page.getByTestId('nav-events').click();
    const preview=page.getByTestId('event-preview');
    await expect(preview).toBeVisible();
    await expect(page.getByRole('timer')).toHaveCount(0);
    const question=page.getByRole('button',{name:ar?'اكشف سؤال':'Reveal Question',exact:true});
    const condition=page.getByRole('button',{name:ar?'اكشف شرط':'Reveal Condition',exact:true});
    await condition.click(); await page.clock.runFor(1500);
    await expect(page.getByRole('timer')).toHaveCount(0);
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await question.click();
    await expect(page.getByRole('timer')).toHaveText(ar?'5ث':'5s');
    await expect(preview).toContainText(ar?'اذكر دولة':'Name a country');
    const initial=Number(await preview.locator('.qc-demo-progress').getAttribute('stroke-dashoffset'));
    await page.clock.runFor(2100);
    await expect(page.getByRole('timer')).toHaveText(ar?'3ث':'3s');
    expect(Number(await preview.locator('.qc-demo-progress').getAttribute('stroke-dashoffset'))).toBeGreaterThan(initial);
    await page.screenshot({path:info.outputPath('inline-countdown.png'),fullPage:true,animations:'disabled'});
    await page.clock.runFor(3100);
    await expect(page.getByRole('timer')).toHaveText(ar?'0ث':'0s');
    await expect(preview.getByRole('status')).toContainText(ar?'انتهى الوقت':'Time’s up');
    await page.getByRole('button',{name:ar?'إعادة المحاولة':'Try again',exact:true}).click();
    await expect(question).toBeEnabled(); await expect(question).toBeFocused();
    await expect(page.getByRole('timer')).toHaveCount(0);
    await question.click(); await condition.click();
    await expect(page.getByRole('timer')).toHaveText(ar?'5ث':'5s');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBeTruthy();
    await expect(page.locator('.manual-game')).toHaveCount(0);
  });
}

test('production query routes and CTAs cannot open the complete host workspace',async({page})=>{
  for(const query of ['?screen=game&lang=ar','?screen=game&legacyPreview=1&lang=ar']) {
    await page.goto(`/${query}`);
    await expect(page.getByTestId('event-preview')).toBeVisible();
    await expect(page.locator('.manual-game, #mg-prizes, #mg-winner-name')).toHaveCount(0);
    await page.getByTestId('product-card-qc').click(); await page.getByTestId('product-try').click();
    await expect(page.getByTestId('event-preview').locator('button').first()).toBeFocused();
    await expect(page.locator('.manual-game')).toHaveCount(0);
    await page.getByTestId('event-how').click(); await page.getByTestId('how-try').click();
    await expect(page.getByTestId('event-preview').locator('button').first()).toBeFocused();
  }
  const scripts=readdirSync('dist/assets').filter(name=>name.endsWith('.js'));
  for(const script of scripts) {
    const source=readFileSync(`dist/assets/${script}`,'utf8');
    expect(source).not.toContain('mg-winners-sidebar');
    expect(source).not.toContain('mg-winner-name');
    expect(source).not.toContain('manual-phase-');
  }
});

test('preview keyboard, reduced motion, locale reset and unmount cleanup',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'}); await page.clock.install();
  await page.goto('/?screen=events&lang=ar');
  const q=page.getByRole('button',{name:'اكشف سؤال',exact:true});
  await q.focus(); await page.keyboard.press('Enter');
  await page.getByRole('button',{name:'اكشف شرط',exact:true}).focus(); await page.keyboard.press('Space');
  await expect(page.getByRole('timer')).toHaveText('5ث');
  await expect(page.locator('.qc-demo-flip').first()).toHaveCSS('transition-duration','0s');
  await page.getByTestId('locale-toggle').click();
  await expect(page.getByRole('timer')).toHaveCount(0);
  await page.getByRole('button',{name:'Reveal Question',exact:true}).click();
  await page.getByRole('button',{name:'Reveal Condition',exact:true}).click();
  await page.getByTestId('nav-home').click();await page.clock.runFor(6000);
  await page.getByTestId('nav-events').click();
  await expect(page.getByRole('timer')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Reveal Question',exact:true})).toBeEnabled();
});
