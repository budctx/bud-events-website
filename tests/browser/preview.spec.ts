import { test, expect } from '@playwright/test';
for (const width of [320, 390, 1440]) for (const locale of ['ar', 'en']) for (const theme of ['light', 'dark']) {
  test(`${width}px ${locale} ${theme}: complete assets and no horizontal overflow`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 });
    await page.goto(`/?canvas=1&lang=${locale}&theme=${theme}`);
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const images = await page.locator('img').evaluateAll(nodes => nodes.filter(n => n.getBoundingClientRect().width > 0).map(n => ({ loaded: n.complete && n.naturalWidth > 0, width: n.getBoundingClientRect().width, expected: n.currentSrc.includes('desktop-question') || n.currentSrc.includes('desktop-condition') ? 48 : n.currentSrc.includes('question') || n.currentSrc.includes('condition') ? 32 : 24 })));
    expect(images.length).toBeGreaterThanOrEqual(4);
    for (const image of images) { expect(image.loaded).toBe(true); expect(image.width).toBe(image.expected); }
    if (width === 390) expect(await page.locator('.specimen-label').evaluate(n => n.getBoundingClientRect().bottom)).toBeLessThanOrEqual(844);
  });
}
test('independent reveal, zero and explicit host judgment', async ({ page }) => {
  await page.clock.install();
  await page.goto('/?lang=en');
  await expect(page.getByRole('button', { name: 'Correct', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Reveal Question' }).click();
  await page.clock.fastForward(8000);
  await expect(page.getByRole('timer')).toHaveText('5');
  await page.getByRole('button', { name: 'Reveal Condition' }).click();
  await page.clock.fastForward(6000);
  await expect(page.getByRole('timer')).toHaveText('0');
  await expect(page.getByText('Time ended · awaiting host judgment')).toBeVisible();
  await expect(page.getByText('Participant qualified · no prize awarded')).toHaveCount(0);
  await page.getByRole('button', { name: 'Correct', exact: true }).click();
  await expect(page.getByText('Participant qualified · no prize awarded')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Incorrect', exact: true })).toBeDisabled();
});
test('retry hides a fresh pair, theme and language survive reload', async ({ page }) => {
  await page.goto('/?lang=en');
  await page.getByLabel('Attempts', { exact: true }).selectOption('2');
  await page.getByRole('button', { name: 'Reveal Question' }).click();
  await page.getByRole('button', { name: 'Reveal Condition' }).click();
  await page.getByRole('button', { name: 'Incorrect', exact: true }).click();
  await expect(page.locator('.attempt')).toContainText('2 / 2');
  await expect(page.locator('.game-card').getByText('Hidden', { exact: true })).toHaveCount(2);
  await page.getByRole('button', { name: 'Reveal Question' }).click();
  await expect(page.getByText('Name three things that are yellow.')).toBeVisible();
  await page.getByLabel('Appearance').selectOption('dark');
  await page.getByLabel('Language').selectOption('ar');
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});
test('keyboard reveal and reduced motion retain behavior', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?lang=en');
  const reveal = page.getByRole('button', { name: 'Reveal Question' });
  await reveal.focus(); await page.keyboard.press('Enter');
  await expect(reveal).toBeDisabled();
  const second = page.getByRole('button', { name: 'Reveal Condition' });
  await second.focus();
  expect(await second.evaluate(n => getComputedStyle(n).outlineWidth)).toBe('4px');
  expect(await second.evaluate(n => getComputedStyle(n).transitionDuration)).toBe('0s, 0s');
});
