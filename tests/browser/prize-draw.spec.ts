import { test, expect, type Page } from '@playwright/test';

async function start(page: Page, ar: boolean, prizes = 'هدية أولى\nهدية ثانية\nهدية ثالثة') {
  await page.goto(`/?screen=game&lang=${ar ? 'ar' : 'en'}`);
  await page.getByLabel(ar ? 'أدخل الجوائز' : 'Enter prizes').fill(prizes);
  await page.getByRole('button', { name: ar ? 'بدء الفعالية' : 'Start event', exact: true }).click();
}
async function add(page: Page, ar: boolean, name: string) {
  await page.getByRole('button', { name: ar ? 'اكشف سؤال' : 'Reveal Question', exact: true }).click();
  await page.getByRole('button', { name: ar ? 'اكشف شرط' : 'Reveal Condition', exact: true }).click();
  await page.getByRole('button', { name: ar ? 'صحيحة' : 'Correct', exact: true }).click();
  await page.getByLabel(ar ? 'اسم الفائز' : 'Winner name', { exact: true }).fill(name);
  await page.getByRole('button', { name: ar ? 'إضافة الفائز' : 'Add winner', exact: true }).click();
}
async function prizes(page: Page, ar: boolean) {
  await page.getByRole('button', { name: ar ? 'صفحة الجوائز' : 'Prize page', exact: true }).click();
}
async function confirm(page: Page, ar: boolean) {
  await page.getByRole('button', { name: ar ? 'افتح جائزته!' : 'Open their prize!', exact: true }).click();
}

for (const ar of [true]) for (const width of [1440, 390, 360]) {
  test(`recipient-first duplicate winner draw ${ar ? 'ar' : 'en'} ${width}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: width === 1440 ? 900 : 667 });
    const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
    await start(page, ar);
    await prizes(page, ar);
    await expect(page.locator('.mg-winners-sidebar')).toContainText(ar ? 'لا يوجد فائزون بعد' : 'No winners yet');
    await expect(page.locator('.mg-prize-card').first()).toBeDisabled();
    await page.screenshot({ path: info.outputPath('empty.png'), fullPage: true });
    await page.getByRole('button', { name: ar ? 'العودة للفعالية' : 'Back to event', exact: true }).click();
    const name = ar ? 'سارة' : 'Sara';
    await add(page, ar, name); await add(page, ar, name);
    await page.getByRole('button', { name: new RegExp(ar ? '^الفائزون' : '^Winners') }).click();
    await expect(page.locator('.mg-management .mg-winner-row')).toHaveCount(2);
    await page.getByRole('button', { name: `${ar ? 'تعديل' : 'Edit'} ${name} #2`, exact: true }).click();
    await page.locator('#mg-edit-name').fill(ar ? 'علي' : 'Ali');
    await page.getByRole('button', { name: ar ? 'حفظ التعديل' : 'Save changes', exact: true }).click();
    await expect(page.getByRole('button', { name: `${ar ? 'تعديل' : 'Edit'} ${ar ? 'علي' : 'Ali'} #2`, exact: true })).toBeFocused();
    await expect(page.locator('[data-winner-id="winner-1"]')).toContainText(name);
    const newName = ar ? 'علي' : 'Ali';
    await page.getByRole('button', { name: `${ar ? 'تعديل' : 'Edit'} ${newName} #2`, exact: true }).click();
    await page.locator('#mg-edit-name').fill(name);
    await page.getByRole('button', { name: ar ? 'حفظ التعديل' : 'Save changes', exact: true }).click();
    await page.screenshot({ path: info.outputPath('management.png'), fullPage: true });
    await page.keyboard.press('Escape');
    await prizes(page, ar);
    await expect(page.locator('.mg-prize-card').first()).toBeDisabled();
    const second = page.locator('.mg-winners-sidebar [data-winner-id="winner-2"] button');
    await second.click();
    await expect(second).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.mg-draw-status')).toContainText(name);
    await page.screenshot({ path: info.outputPath('selected.png'), fullPage: true });
    await page.locator('.mg-prize-card').first().click();
    const confirmation = page.locator('.mg-award-confirm');
    await expect(confirmation).toContainText(name);
    await expect(confirmation.locator('.mg-winner-number')).toHaveText('2');
    for(const prize of ['هدية أولى','هدية ثانية','هدية ثالثة']) await expect(confirmation).not.toContainText(prize);
    await page.screenshot({ path: info.outputPath('confirm.png'), fullPage: true });
    await page.keyboard.press('Escape');
    await expect(second).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.mg-prize-card').first()).toHaveAttribute('data-revealed', 'false');
    await page.locator('.mg-prize-card').first().click();
    await confirm(page, ar);
    await expect(page.locator('.mg-award-result')).toBeVisible();
    await expect(page.locator('.mg-result-prize')).toHaveText(/^هدية (أولى|ثانية|ثالثة)$/);
    await expect(page.locator('.mg-confetti')).toHaveCount(1);
    await page.waitForTimeout(700); // Capture the visible burst, rather than its first frame.
    await page.screenshot({ path: info.outputPath('result.png'), fullPage: true });
    await page.getByRole('button', { name: ar ? 'متابعة السحب' : 'Continue draw', exact: true }).click();
    await expect(second).toBeDisabled();
    await expect(page.locator('.mg-prize-card').first()).toContainText(name);
    await page.getByRole('checkbox', { name: ar ? 'مؤثرات الاحتفال' : 'Celebration effects' }).uncheck();
    await page.locator('.mg-winners-sidebar [data-winner-id="winner-1"] button').click();
    await page.locator('.mg-prize-card').nth(1).click(); await confirm(page, ar);
    await expect(page.locator('.mg-confetti')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(page.locator('.mg-draw-status')).toContainText(ar ? 'حصل جميع الفائزين' : 'All winners');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBeTruthy();
    expect(errors).toEqual([]);
  });
}

test('management deletion is cancelable and never reuses record IDs', async ({ page }) => {
  await start(page, true); await add(page, true, 'سارة'); await add(page, true, 'سارة');
  await page.getByRole('button', { name: /^الفائزون/ }).click();
  await page.getByRole('button', { name: 'حذف سارة #1', exact: true }).click();
  await page.getByRole('button', { name: 'إلغاء', exact: true }).click();
  await expect(page.locator('.mg-winner-row')).toHaveCount(2);
  await page.getByRole('button', { name: 'حذف سارة #1', exact: true }).click();
  await page.getByRole('button', { name: 'تأكيد الحذف', exact: true }).click();
  await page.keyboard.press('Escape');
  await add(page, true, 'سارة');
  await prizes(page, true);
  await expect(page.locator('.mg-winners-sidebar [data-winner-id="winner-1"]')).toHaveCount(0);
  await expect(page.locator('.mg-winners-sidebar [data-winner-id="winner-3"]')).toBeVisible();
});

test('single winner, reduced motion, keyboard confirmation and terminal read-only results', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 375, height: 667 });
  await start(page, true, 'هدية'); await add(page, true, 'سارة'); await prizes(page, true);
  await page.locator('.mg-winner-option').focus(); await page.keyboard.press('Enter');
  await page.locator('.mg-prize-card').focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'إلغاء', exact: true })).toBeFocused();
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press('Tab');
    expect(await page.locator('.mg-award-confirm').evaluate(el => el.contains(document.activeElement))).toBeTruthy();
  }
  await confirm(page, true); await expect(page.locator('.mg-confetti')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'إنهاء الفعالية', exact: true }).click();
  await page.getByRole('button', { name: 'إنهاء وعرض النتائج', exact: true }).click();
  await page.getByRole('button', { name: /^الفائزون/ }).click();
  await expect(page.locator('.mg-management')).toContainText('سارة');
  await expect(page.locator('.mg-winner-tools')).toHaveCount(0);
});

test('many winners, long names and full prize list remain usable on short mobile', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 667 });
  await start(page, true, Array.from({ length: 50 }, (_, i) => `هدية ${i + 1}`).join('\n'));
  for (let i = 0; i < 8; i++) await add(page, true, i === 7 ? 'س'.repeat(80) : 'سارة');
  await prizes(page, true);
  const last = page.locator('.mg-winners-sidebar [data-winner-id="winner-8"] button');
  await last.click(); await expect(last).toHaveAttribute('aria-pressed', 'true');
  await page.locator('.mg-prize-card').last().scrollIntoViewIfNeeded();
  await expect(page.locator('.mg-draw-status')).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBeTruthy();
  await page.locator('.mg-prize-card').last().click();
  await expect(page.locator('.mg-award-confirm')).toContainText('س'.repeat(80));
  await expect(page.getByRole('button', { name: 'افتح جائزته!', exact: true })).toBeInViewport();
});

test('deleting an awarded record explains and restores only its prize', async ({ page }) => {
  await start(page, true); await add(page, true, 'سارة'); await add(page, true, 'سارة');
  await prizes(page, true); await page.locator('.mg-winner-option').first().click();
  await page.locator('.mg-prize-card').first().click(); await confirm(page, true);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /^الفائزون/ }).click();
  await page.getByRole('button', { name: 'حذف سارة #1', exact: true }).click();
  await expect(page.locator('.mg-management')).toContainText('ستُعاد جائزته إلى البطاقات المتاحة للسحب');
  await page.getByRole('button', { name: 'تأكيد الحذف', exact: true }).click();
  await expect(page.getByRole('button', { name: 'إغلاق', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('.mg-prize-card').first()).toHaveAttribute('data-revealed', 'false');
  await page.locator('.mg-winner-option').click();
  await page.locator('.mg-prize-card').first().click(); await confirm(page, true);
  await expect(page.locator('.mg-award-result .mg-winner-number')).toHaveText('2');
});

test('prize suspense hides the result until reveal and can be skipped without duplicate awards', async ({page}) => {
  await start(page,true); await add(page,true,'سارة'); await prizes(page,true);
  await page.locator('.mg-winner-option').click(); await page.locator('.mg-prize-card').first().click();
  await confirm(page,true);
  await expect(page.locator('.mg-reveal-experience')).toHaveAttribute('data-stage','anticipation');
  await expect(page.locator('.mg-result-prize')).toHaveCount(0);
  await expect(page.locator('.mg-confetti')).toHaveCount(0);
  await page.getByRole('button',{name:'اكشف الآن',exact:true}).click();
  await expect(page.locator('.mg-result-prize')).toHaveText(/^هدية (أولى|ثانية|ثالثة)$/);
  await expect(page.locator('.mg-confetti')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(page.locator('.mg-prize-card[data-revealed=true]')).toHaveCount(1);
  await expect(page.locator('.mg-winner-option')).toBeDisabled();
});

test('suspense finishes automatically and reduced motion reveals instantly', async ({page}) => {
  await start(page,true); await add(page,true,'سارة'); await add(page,true,'علي'); await prizes(page,true);
  await page.locator('.mg-winner-option').first().click(); await page.locator('.mg-prize-card').first().click(); await confirm(page,true);
  await expect(page.locator('.mg-reveal-experience')).toHaveAttribute('data-stage','anticipation');
  await expect(page.locator('.mg-result-prize')).toHaveText(/^هدية (أولى|ثانية|ثالثة)$/);
  const firstAward=await page.locator('.mg-result-prize').textContent();
  await expect(page.getByRole('button',{name:'متابعة السحب',exact:true})).toBeFocused();
  await page.keyboard.press('Escape');
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.locator('.mg-winner-option:not(:disabled)').click(); await page.locator('.mg-prize-card').nth(1).click(); await confirm(page,true);
  await expect(page.locator('.mg-reveal-experience')).toHaveAttribute('data-stage','revealed');
  await expect(page.locator('.mg-result-prize')).toHaveText(/^هدية (أولى|ثانية|ثالثة)$/);
  expect(await page.locator('.mg-result-prize').textContent()).not.toBe(firstAward);
  await expect(page.locator('.mg-anticipation, .mg-confetti')).toHaveCount(0);
});

for(const ar of [true]) test(`manual remaining prizes and host winner replacement ${ar?'ar':'en'}`, async ({page},info) => {
  await page.setViewportSize({width:390,height:844});
  await page.emulateMedia({reducedMotion:'reduce'});
  await start(page,ar,'Gift one\nGift two'); await prizes(page,ar);
  await page.getByRole('button',{name:ar?'إضافة فائز':'Add a winner',exact:true}).click();
  await page.locator('#mg-add-name').fill('Sara');
  await page.getByRole('button',{name:ar?'إضافة الفائز':'Add winner',exact:true}).click();
  await expect(page.getByRole('button',{name:'Edit Sara #1'.replace('Edit',ar?'تعديل':'Edit'),exact:true})).toBeFocused();
  await page.locator('.mg-management').getByRole('button',{name:ar?'إضافة فائز':'Add a winner',exact:true}).click();
  await page.locator('#mg-add-name').fill('Sara');
  await page.getByRole('button',{name:ar?'إضافة الفائز':'Add winner',exact:true}).click();
  await expect(page.locator('.mg-management').getByRole('button',{name:ar?'إضافة فائز':'Add a winner',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:ar?'حذف Sara #1':'Delete Sara #1',exact:true}).click();
  await page.getByRole('button',{name:ar?'تأكيد الحذف':'Confirm deletion',exact:true}).click();
  await page.locator('.mg-management').getByRole('button',{name:ar?'إضافة فائز':'Add a winner',exact:true}).click();
  await page.locator('#mg-add-name').fill('Ali');
  await page.getByRole('button',{name:ar?'إضافة الفائز':'Add winner',exact:true}).click();
  await expect(page.locator('.mg-management [data-winner-id="winner-3"]')).toContainText('Ali');
  await page.keyboard.press('Escape');
  await page.locator('.mg-winner-option').first().click();
  await page.locator('.mg-prize-card').first().click();await confirm(page,ar);
  await page.keyboard.press('Escape');
  await page.getByRole('button',{name:ar?'فتح دون اسم':'Open without a name',exact:true}).click();
  await expect(page.locator('.mg-draw-status')).toContainText(ar?'دون تخصيص اسم':'without a recipient');
  await page.locator('.mg-prize-card').nth(1).click();
  await expect(page.locator('.mg-award-confirm')).toContainText(ar?'لن ترتبط بأي اسم':'no name will be assigned');
  await page.keyboard.press('Escape');
  await expect(page.locator('.mg-prize-card').nth(1)).toHaveAttribute('data-revealed','false');
  await page.locator('.mg-prize-card').nth(1).click();
  await page.getByRole('button',{name:ar?'افتح دون اسم!':'Open without a name!',exact:true}).click();
  await expect(page.locator('.mg-result-prize')).toHaveText(/^Gift (one|two)$/);
  const revealedUnnamed=(await page.locator('.mg-result-prize').textContent())!;
  await expect(page.locator('.mg-result-winner')).toContainText(ar?'دون تخصيص اسم':'without a recipient');
  await page.screenshot({path:info.outputPath('manual-open.png'),fullPage:true});
  await page.keyboard.press('Escape');
  await expect(page.locator('.mg-prize-card').nth(1)).toContainText(ar?'دون اسم':'No recipient');
  await page.getByRole('button',{name:ar?'إنهاء الفعالية':'End event',exact:true}).click();
  await page.getByRole('button',{name:ar?'إنهاء وعرض النتائج':'End and view results',exact:true}).click();
  await expect(page.locator('.mg-unnamed-results')).toContainText(revealedUnnamed);
  await expect(page.locator('.mg-results')).toContainText('Ali');
  await page.getByRole('button',{name:ar?'تجربة جديدة':'New rehearsal',exact:true}).click();
  await page.getByLabel(ar?'أدخل الجوائز':'Enter prizes').fill('New');
  await page.getByRole('button',{name:ar?'بدء الفعالية':'Start event',exact:true}).click();await prizes(page,ar);
  await expect(page.getByRole('button',{name:ar?'فتح دون اسم':'Open without a name',exact:true})).toHaveAttribute('aria-pressed','false');
});

test('all prizes can be manually opened with an empty winner list', async ({page}) => {
  await page.emulateMedia({reducedMotion:'reduce'});await start(page,true,'هدية');await prizes(page,true);
  await page.getByRole('button',{name:'فتح دون اسم',exact:true}).click();
  await page.locator('.mg-prize-card').click();await page.getByRole('button',{name:'افتح دون اسم!',exact:true}).click();
  await expect(page.locator('.mg-result-prize')).toHaveText('هدية');
  await page.keyboard.press('Escape');await expect(page.locator('.mg-winner-option')).toHaveCount(0);
  await expect(page.locator('.mg-prize-card')).toBeDisabled();
});
