import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
async function setup(page: Page, count = 0) {
  await page.getByLabel('Event name', { exact: true }).fill('BU’D example event');
  await page.getByLabel('Prize count · 0–50', { exact: true }).fill(String(count));
  await page.getByRole('button', { name: 'Prize Setup', exact: true }).click();
  for (let i = 1; i <= count; i++) {
    if (i > 1 && (i - 1) % 3 === 0) await page.getByRole('button', { name: 'Next', exact: true }).click();
    await page.getByLabel(`Prize ${i}`, { exact: true }).fill(`Example reward ${i}`);
  }
  await page.getByRole('button', { name: 'Start event', exact: true }).click();
}
async function qualify(page: Page, n = 1) {
  await page.getByRole('button', { name: `Example player ${n} · Not played yet`, exact: true }).click();
  await page.getByRole('button', { name: 'Reveal Question', exact: true }).click();
  await page.getByRole('button', { name: 'Reveal Condition', exact: true }).click();
  await page.getByRole('button', { name: 'Correct', exact: true }).click();
}
for (const lang of ['ar','en']) for (const theme of ['light','dark']) for (const width of [320,390,1440]) {
  test(`setup fit viewport ${lang} ${theme} ${width}`, async ({ page }) => {
    await page.setViewportSize({width, height: width === 1440 ? 900 : 844});
    await page.goto(`/?lang=${lang}&theme=${theme}`);
    await expect(page.locator('main')).toHaveAttribute('data-stage','setup-basics');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true);
    await page.locator('#event-name').fill('اسم طويل / A long event name');
    await page.locator('.prize-counter input').fill('50');
    await page.locator('form > button').click();
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.locator('.prize-editor')).toHaveCount(3);
    await expect(page.locator('.pagination')).toContainText('1 / 17');
  });
}
test('zero prizes preserves all phases and honest final empty results', async ({ page }) => {
  await page.goto('/?lang=en'); await setup(page); await qualify(page);
  await expect(page.getByText('Correct answer · no prize', {exact:true})).toBeVisible();
  await page.getByRole('button', { name: 'Prizes', exact:true }).click();
  await expect(page.getByText('This event has no prizes')).toBeVisible();
  await expect(page.getByRole('button',{name:'Restart from zero'})).toHaveCount(0);
  await page.getByRole('button', { name: 'Closing', exact:true }).click();
  await expect(page.getByText('No prize received', {exact:true})).toBeVisible();
  await page.getByRole('button', { name: 'End event', exact:true }).click();
  await page.getByRole('button',{name:'Cancel',exact:true}).click();
  await expect(page.locator('main')).toHaveAttribute('data-stage','closing');
  await page.getByRole('button', { name: 'End event', exact:true }).click();
  await page.getByRole('button',{name:'Confirm',exact:true}).click();
  await expect(page.locator('main')).toHaveAttribute('data-stage','completed');
  await expect(page.getByText('No prizes awarded',{exact:true})).toBeVisible();
  await expect(page.getByText('Example player 1')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Return to Prizes'})).toHaveCount(0);
});
test('assignment confirmation, permanent opening lock and actual ordered results', async ({ page }) => {
  await page.setViewportSize({width:390,height:844});
  await page.goto('/?lang=en&theme=dark'); await setup(page, 2); await qualify(page,1); await qualify(page,2);
  await page.getByRole('button', {name:'Prizes',exact:true}).click();
  await page.getByLabel('Qualified participants').selectOption('local-player-2');
  await page.locator('.prize-card').first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.prize-card').first()).toBeEnabled();
  await page.locator('.prize-card').first().click();
  await page.getByRole('button',{name:'Confirm',exact:true}).click();
  await expect(page.locator('.prize-card').first()).toBeDisabled();
  await expect(page.getByLabel('Qualified participants')).toHaveValue('');
  await expect(page.getByRole('button',{name:'Return to Event Screen'})).toBeDisabled();
  await expect(page.getByRole('button',{name:'Restart from zero'})).toHaveCount(0);
  await page.getByLabel('Qualified participants').selectOption('local-player-1');
  await page.locator('.prize-card').nth(1).click(); await page.getByRole('button',{name:'Confirm',exact:true}).click();
  const imgs = await page.locator('img').evaluateAll(ns=>ns.map(n=>({width:n.getBoundingClientRect().width,loaded:n.complete&&n.naturalWidth>0})));
  for(const img of imgs) expect(img.loaded).toBe(true);
  await page.getByRole('button',{name:'Closing',exact:true}).click();
  await expect(page.locator('.winner-row').first()).toContainText('Example player 1');
  await page.getByRole('button',{name:'End event',exact:true}).click(); await page.getByRole('button',{name:'Confirm',exact:true}).click();
  await expect(page.locator('.winner-row')).toHaveCount(1);
  await expect(page.locator('.winner-row').first()).toContainText('Example player 1');
  await expect(page.locator('.winner-row').first()).toContainText('Example reward 2');
  await expect(page.locator('.winner-row').first()).toContainText('Unverified example identifier');
});
test('open unassigned and cancel closing keep committed prize; keyboard modal trap', async ({ page }) => {
  await page.emulateMedia({reducedMotion:'reduce'}); await page.goto('/?lang=en'); await setup(page,2);
  await page.getByRole('button',{name:'Prizes',exact:true}).click(); await page.locator('.prize-card').first().click();
  await expect(page.getByRole('dialog')).toContainText('Open without a recipient?');
  await page.getByRole('button',{name:'Cancel',exact:true}).focus();
  await page.keyboard.press('Shift+Tab'); await expect(page.getByRole('button',{name:'Confirm',exact:true})).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('.prize-card').first()).toContainText('Opened without a recipient');
  await page.getByRole('button',{name:'Closing',exact:true}).click(); await page.getByRole('button',{name:'Cancel',exact:true}).click();
  await expect(page.locator('main')).toHaveAttribute('data-stage','prizes');
  await expect(page.locator('.prize-card').first()).toBeDisabled();
  await expect(page.getByRole('button',{name:'Closing',exact:true})).toBeFocused();
  await page.getByRole('button',{name:'Closing',exact:true}).click(); await page.getByRole('button',{name:'Confirm',exact:true}).click();
  await page.getByRole('button',{name:'Return to Prizes',exact:true}).click();
  await expect(page.locator('.prize-card').first()).toBeDisabled();
});
test('all 50 prize editors reachable and start requires completed contents',async ({page})=>{
  await page.setViewportSize({width:390,height:844}); await page.goto('/?lang=en'); await setup(page,50);
  await expect(page.locator('main')).toHaveAttribute('data-stage','live');
  await page.getByRole('button',{name:'Prizes',exact:true}).click();
  await expect(page.locator('.pagination')).toContainText('1 / 25');
  for(let i=0;i<24;i++) await page.getByRole('button',{name:'Next',exact:true}).click();
  await expect(page.locator('.prize-card')).toHaveCount(2);
  await expect(page.locator('.prize-card').last()).toContainText('50');
});
test('capacity practice success does not announce new qualification',async ({page})=>{
  await page.goto('/?lang=en'); await setup(page,1); await qualify(page,1);
  await page.getByRole('button',{name:'Example player 2 · Not played yet',exact:true}).click();
  await page.getByRole('button',{name:'Confirm',exact:true}).click();
  await page.getByRole('button',{name:'Reveal Question',exact:true}).click();
  await page.getByRole('button',{name:'Reveal Condition',exact:true}).click();
  await page.getByRole('button',{name:'Correct',exact:true}).click();
  await expect(page.getByText('Correct answer · no prize',{exact:true})).toBeVisible();
});
for(const width of [320,390,1440]) test(`live and opened long-content prizes fit ${width}`,async ({page})=>{
  await page.setViewportSize({width,height:width===1440?900:844}); await page.goto('/?lang=en&theme=dark');
  await page.getByLabel('Event name',{exact:true}).fill('Long content event');
  await page.getByLabel('Prize count · 0–50',{exact:true}).fill('4');
  await page.getByRole('button',{name:'Prize Setup',exact:true}).click();
  for(let i=1;i<=4;i++) { if(i===4) await page.getByRole('button',{name:'Next',exact:true}).click(); await page.getByLabel(`Prize ${i}`,{exact:true}).fill('Long prize description '.repeat(4)); }
  await page.getByRole('button',{name:'Start event',exact:true}).click();
  await page.getByRole('button',{name:'Example player 1 · Not played yet',exact:true}).click();
  expect(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight)).toBe(true);
  await page.getByRole('button',{name:'Reveal Question',exact:true}).click(); await page.getByRole('button',{name:'Reveal Condition',exact:true}).click(); await page.getByRole('button',{name:'Correct',exact:true}).click();
  await page.getByRole('button',{name:'Prizes',exact:true}).click();
  for(const card of await page.locator('.prize-card').all()) { await card.click(); await page.getByRole('button',{name:'Confirm',exact:true}).click(); }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight)).toBe(true);
});
