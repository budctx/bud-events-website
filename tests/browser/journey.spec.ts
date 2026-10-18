import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
async function setup(page: Page, count = 0) {
  await page.getByLabel('Event name', { exact: true }).fill('BU’D example event');
  await page.getByRole('button', { name: 'Prize Setup', exact: true }).click();
  await page.getByLabel('Prizes', {exact:true}).fill(Array.from({length:count},(_,i)=>`Example reward ${i+1}`).join('\n'));
  await page.getByRole('button', { name: 'Start event', exact: true }).click();
}
async function qualify(page: Page, n = 1) {
  await page.getByRole('button', { name: `Example player ${n} · Not played yet`, exact: true }).click();
  await page.getByRole('button', { name: 'Reveal Question', exact: true }).click();
  await page.getByRole('button', { name: 'Reveal Condition', exact: true }).click();
  await page.getByRole('button', { name: 'Correct', exact: true }).click();
}
for (const lang of ['ar','en']) for (const theme of ['light']) for (const width of [320,390,1440]) {
  test(`setup fit viewport ${lang} ${theme} ${width}`, async ({ page }) => {
    await page.setViewportSize({width, height: width === 1440 ? 900 : 844});
    await page.goto(`/?lang=${lang}&theme=${theme}`);
    await expect(page.locator('main')).toHaveAttribute('data-stage','setup-basics');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true);
    await page.locator('#event-name').fill('اسم طويل / A long event name');
    await page.locator('form > button').click();
    await page.getByLabel(lang==='ar'?'الجوائز':'Prizes',{exact:true}).fill(Array.from({length:50},(_,i)=>`Prize ${i+1}`).join('\n'));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true);
    await expect(page.locator('#prize-lines')).toHaveCount(1);
    await expect(page.locator('#prize-lines-count')).toContainText('50 / 50');
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
  await page.goto('/?lang=en&theme=light'); await setup(page, 2); await qualify(page,1); await qualify(page,2);
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
  await page.getByRole('button',{name:'Next',exact:true}).click(); await page.locator('.prize-card').first().click(); await page.getByRole('button',{name:'Confirm',exact:true}).click();
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
test('50 prize lines produce 50 reachable prize cards',async ({page})=>{
  await page.setViewportSize({width:390,height:844}); await page.goto('/?lang=en'); await setup(page,50);
  await expect(page.locator('main')).toHaveAttribute('data-stage','live');
  await page.getByRole('button',{name:'Prizes',exact:true}).click();
  await expect(page.locator('.pagination')).toContainText('1 / 50');
  for(let i=0;i<49;i++) await page.getByRole('button',{name:'Next',exact:true}).click();
  await expect(page.locator('.prize-card')).toHaveCount(1);
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
  await page.setViewportSize({width,height:width===1440?900:844}); await page.goto('/?lang=en&theme=light');
  await page.getByLabel('Event name',{exact:true}).fill('Long content event');
  await page.getByRole('button',{name:'Prize Setup',exact:true}).click();
  await page.getByLabel('Prizes',{exact:true}).fill(Array.from({length:4},()=> 'Long prize description '.repeat(4)).join('\n'));
  await page.getByRole('button',{name:'Start event',exact:true}).click();
  await page.getByRole('button',{name:'Example player 1 · Not played yet',exact:true}).click();
  expect(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight)).toBe(true);
  await page.getByRole('button',{name:'Reveal Question',exact:true}).click(); await page.getByRole('button',{name:'Reveal Condition',exact:true}).click(); await page.getByRole('button',{name:'Correct',exact:true}).click();
  await page.getByRole('button',{name:'Prizes',exact:true}).click();
  for(const card of await page.locator('.prize-card').all()) { await card.click(); await page.getByRole('button',{name:'Confirm',exact:true}).click(); }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight)).toBe(true);
});
test('multiline prizes derive count, retain invalid draft and block start',async({page})=>{
  await page.goto('/?lang=en'); await page.getByLabel('Event name',{exact:true}).fill('Prize lines');
  await page.getByRole('button',{name:'Prize Setup',exact:true}).click();
  const box=page.getByLabel('Prizes',{exact:true}); await box.fill('  Gift card  \n\nGift card\n Month membership\n');
  await expect(page.locator('#prize-lines-count')).toContainText('3 / 50');
  await expect(page.getByRole('button',{name:'Start event',exact:true})).toBeEnabled();
  const invalid=Array.from({length:51},(_,i)=>`Reward ${i}`).join('\n'); await box.fill(invalid);
  await expect(box).toHaveValue(invalid); await expect(box).toHaveAttribute('aria-invalid','true');
  await expect(page.getByRole('button',{name:'Start event',exact:true})).toBeDisabled();
  await expect(page.getByRole('alert')).toContainText('Maximum 50 prizes');
  await box.fill('W'.repeat(101)); await expect(page.getByRole('alert')).toContainText('Line 1');
  await box.fill(''); await expect(page.getByRole('button',{name:'Start event',exact:true})).toBeEnabled();
});
test('white card faces, emblems and flip do not delay optional timer',async({page})=>{
  await page.goto('/?lang=en'); await page.getByLabel('Enable timer').check(); await setup(page,1);
  await page.getByRole('button',{name:'Example player 1 · Not played yet',exact:true}).click();
  const q=page.locator('.playing-card--question'),c=page.locator('.playing-card--condition');
  const size=await q.evaluate(n=>({w:n.getBoundingClientRect().width,h:n.getBoundingClientRect().height}));
  expect(size.w/size.h).toBeCloseTo(1.4,1);
  expect(await q.locator('.card-face--front').evaluate(n=>getComputedStyle(n).backgroundColor)).toBe('rgb(255, 255, 255)');
  expect(await c.locator('.card-face--front').evaluate(n=>getComputedStyle(n).backgroundColor)).toBe('rgb(255, 255, 255)');
  expect(await q.locator('.flip-inner').evaluate(n=>getComputedStyle(n).transitionDuration)).toBe('0.42s');
  await expect(q.locator('.card-face--front .card-emblem')).toHaveCount(2);
  await expect(c.locator('.card-face--front .card-emblem')).toHaveCount(2);
  await page.getByRole('button',{name:'Reveal Question',exact:true}).click();
  await expect(q).toHaveAttribute('data-revealed','true'); await expect(q.locator('.card-face--front')).toHaveAttribute('inert','');
  await page.getByRole('button',{name:'Reveal Condition',exact:true}).click();
  await expect(page.getByText('Countdown',{exact:true})).toBeVisible();
  await page.emulateMedia({reducedMotion:'reduce'});
  expect(await c.locator('.flip-inner').evaluate(n=>getComputedStyle(n).transitionDuration)).toBe('0s');
  expect(await c.locator('.flip-inner').evaluate(n=>getComputedStyle(n).transform)).toBe('none');
  await expect(page.getByText('Start your answer with “I bring”.',{exact:true})).toBeVisible();
});
test('100-character prize back fits landscape face after flip',async({page})=>{
  await page.setViewportSize({width:320,height:844}); await page.goto('/?lang=en');
  await page.getByLabel('Event name',{exact:true}).fill('Long prize'); await page.getByRole('button',{name:'Prize Setup',exact:true}).click();
  await page.getByLabel('Prizes',{exact:true}).fill('W'.repeat(100));
  await page.getByRole('button',{name:'Start event',exact:true}).click(); await page.getByRole('button',{name:'Prizes',exact:true}).click();
  await page.locator('.prize-card').click(); await page.getByRole('button',{name:'Confirm',exact:true}).click();
  await page.waitForTimeout(450);
  const fits=await page.locator('.playing-card--prize .card-face--back').evaluate(n=>n.scrollHeight<=n.clientHeight&&[...n.children].every(c=>c.getBoundingClientRect().bottom<=n.getBoundingClientRect().bottom+1));
  expect(fits).toBe(true);
});

test('card activation by keyboard, hidden timer by default and icon judgment', async ({page}) => {
  await page.goto('/?lang=en');
  await expect(page.getByLabel('Enable timer')).not.toBeChecked();
  await setup(page,1);
  await page.getByRole('button',{name:'Example player 1 · Not played yet'}).click();
  const question=page.getByRole('button',{name:'Reveal Question',exact:true});
  await question.focus(); await page.keyboard.press('Enter');
  await expect(page.locator('.playing-card--question')).toHaveAttribute('data-revealed','true');
  await page.getByRole('button',{name:'Reveal Condition',exact:true}).click();
  await expect(page.locator('.journey .timer')).toHaveCount(0);
  const correct=page.getByRole('button',{name:'Correct',exact:true});
  const wrong=page.getByRole('button',{name:'Incorrect',exact:true});
  await expect(correct.locator('svg')).toHaveCount(1);
  await expect(wrong.locator('svg')).toHaveCount(1);
  await correct.click();
  await expect(page.getByText('Participant qualified · no prize awarded',{exact:true})).toBeVisible();
});


test('host can add a named local participant and play a complete round', async ({ page }) => {
  await page.goto('/?lang=en&theme=light');
  await setup(page, 1);
  await page.getByText('Add a player for this preview').click();
  await page.getByLabel('Player name').fill('Local guest');
  await page.getByRole('button', { name: 'Add to attendance' }).click();
  await expect(page.getByRole('button', { name: 'Local guest · Not played yet' })).toBeVisible();
  await page.getByRole('button', { name: 'Local guest · Not played yet' }).click();
  await page.getByRole('button', { name: 'Reveal Question' }).click();
  await page.getByRole('button', { name: 'Reveal Condition' }).click();
  await page.getByRole('button', { name: 'Correct' }).click();
  await page.getByRole('button', { name: 'Prizes', exact: true }).click();
  await page.getByLabel('Qualified participants').selectOption('local-guest-4');
  await page.locator('.prize-card').first().click();
  await page.getByRole('button', { name: 'Confirm' }).click();
  await expect(page.locator('.prize-card').first()).toBeDisabled();
});
