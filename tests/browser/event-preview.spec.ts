import { test, expect } from '@playwright/test';
import { readdirSync, readFileSync } from 'node:fs';

test.use({baseURL:'http://127.0.0.1:4175'});

for(const locale of ['ar','en']) for(const size of [{width:1440,height:900},{width:390,height:844},{width:320,height:568}]) {
  test(`production fixed cards and five-second countdown ${locale} ${size.width}`,async({page},info)=>{
    const ar=true; await page.setViewportSize(size);
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
    const initial=Number(await preview.locator('.event-countdown-progress').getAttribute('stroke-dashoffset'));
    await page.clock.runFor(2100);
    await expect(page.getByRole('timer')).toHaveText(ar?'3ث':'3s');
    expect(Number(await preview.locator('.event-countdown-progress').getAttribute('stroke-dashoffset'))).toBeGreaterThan(initial);
    for(const card of await preview.locator('.mg-card').all()) {
      const spacing=await card.evaluate(el=>({content:el.querySelector('.mg-card-content')!.getBoundingClientRect().toJSON(),title:el.querySelector('.mg-face-title')!.getBoundingClientRect().toJSON(),footer:el.querySelector('.mg-face-footer')!.getBoundingClientRect().toJSON()}));
      expect(spacing.content.bottom).toBeLessThan(spacing.footer.top-2);
      expect(spacing.content.top).toBeGreaterThan(spacing.title.bottom+2);
    }
    await page.screenshot({path:info.outputPath('inline-countdown.png'),fullPage:true,animations:'disabled'});
    await page.clock.runFor(3100);
    await expect(page.getByRole('timer')).toHaveText(ar?'0ث':'0s');
    await expect(page.locator('.bud-toast')).toContainText(ar?'انتهى الوقت':'Time’s up');
    await page.getByRole('button',{name:ar?'إعادة المحاولة':'Try again',exact:true}).click();
    await expect(question).toBeEnabled(); await expect(question).toBeFocused();
    await expect(page.getByRole('timer')).toHaveCount(0);
    await question.click(); await condition.click();
    await expect(page.getByRole('timer')).toHaveText(ar?'5ث':'5s');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBeTruthy();
    await expect(page.locator('.manual-game')).toHaveCount(0);
  });
}

test('production routes stay limited and trial CTA is absent',async({page})=>{
  for(const query of ['?screen=game&lang=ar','?screen=game&legacyPreview=1&lang=ar']) {
    await page.goto(`/${query}`);
    await expect(page.getByTestId('event-preview')).toBeVisible();
    await expect(page.locator('.manual-game, #mg-prizes, #mg-winner-name')).toHaveCount(0);
    await page.getByTestId('product-card-qc').click();
    await expect(page.getByTestId('product-try')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(page.locator('.manual-game')).toHaveCount(0);
    await page.getByTestId('event-how').click();
    await expect(page.getByTestId('how-try')).toHaveCount(0);
    await page.keyboard.press('Escape');
  }
  const scripts=readdirSync('dist/assets').filter(name=>name.endsWith('.js'));
  // Authenticated hosts have a separate lazy bundle; public routing must never
  // load that bundle merely by adding a legacy query parameter.
  for(const script of scripts.filter(name=>name.startsWith('index-'))) {
    const source=readFileSync(`dist/assets/${script}`,'utf8');
    expect(source).not.toContain('mg-winners-sidebar');
    expect(source).not.toContain('mg-winner-name');
    expect(source).not.toContain('manual-phase-');
  }
  await expect(page.locator('.manual-game')).toHaveCount(0);
});

test('preview keyboard, reduced motion, locale reset and unmount cleanup',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'}); await page.clock.install();
  await page.goto('/?screen=events&lang=ar');
  const q=page.getByRole('button',{name:'اكشف سؤال',exact:true});
  await q.focus(); await page.keyboard.press('Enter');
  await page.getByRole('button',{name:'اكشف شرط',exact:true}).focus(); await page.keyboard.press('Space');
  await expect(page.getByRole('timer')).toHaveText('5ث');
  await expect(page.locator('.mg-flip-inner').first()).toHaveCSS('transition-duration','0s');
  await expect(page.getByTestId('locale-toggle')).toHaveCount(0);
  await page.getByTestId('nav-home').click();
  await page.getByTestId('nav-events').click();
  await expect(page.getByRole('timer')).toHaveCount(0);
  await page.getByRole('button',{name:'اكشف سؤال',exact:true}).click();
  await page.getByRole('button',{name:'اكشف شرط',exact:true}).click();
  await page.getByTestId('nav-home').click();await page.clock.runFor(6000);
  await page.getByTestId('nav-events').click();
  await expect(page.getByRole('timer')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'اكشف سؤال',exact:true})).toBeEnabled();
});

test('sample and host use identical card faces, marks and flip styles at the same width',async({page,browser})=>{
  await page.setViewportSize({width:1440,height:900});
  await page.goto('/?screen=events&lang=ar');
  const sample=page.locator('.qc-demo-card').first();
  await sample.click();
  await expect(sample.locator('.mg-card-visible')).toHaveCSS('background-color','rgb(253, 253, 255)');
  const width=await sample.evaluate(el=>el.getBoundingClientRect().width);
  const host=await browser.newPage({viewport:{width:1440,height:900}});
  await host.goto('http://127.0.0.1:4173/?screen=game&lang=ar');
  await host.getByRole('button',{name:'بدء الفعالية',exact:true}).click();
  await host.locator('.mg-cards').evaluate((el,w)=>{ (el as HTMLElement).style.width=`${w*2+16}px`; },width);
  const game=host.locator('.mg-card').first();await game.click();
  for(const selector of ['.mg-card-hidden','.mg-card-visible','.mg-corner-top','.mg-hidden-center b','.mg-card-content']) {
    const properties=['backgroundColor','borderTopWidth','borderRadius','boxShadow','fontSize','width'];
    const actual=await sample.locator(selector).first().evaluate((el,props)=>props.map(p=>getComputedStyle(el).getPropertyValue(p.replace(/[A-Z]/g,m=>`-${m.toLowerCase()}`))),properties);
    const expected=await game.locator(selector).first().evaluate((el,props)=>props.map(p=>getComputedStyle(el).getPropertyValue(p.replace(/[A-Z]/g,m=>`-${m.toLowerCase()}`))),properties);
    // Content width depends on the fixed sample text; all other visual properties share one source.
    expect(actual.slice(0,selector==='.mg-card-content'?-1:undefined)).toEqual(expected.slice(0,selector==='.mg-card-content'?-1:undefined));
  }
  await expect(sample.locator('.mg-corner')).toHaveCount(4);
  await host.close();
});
