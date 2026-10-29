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
  await page.getByRole('button', { name: ar ? 'إضافة فائز' : 'Add winner', exact: true }).click();
}
async function prizes(page: Page, ar: boolean) {
  await page.getByRole('button', { name: ar ? 'الجوائز' : 'Prize page', exact: true }).click();
}
async function confirm(page: Page, ar: boolean) {
  await page.getByRole('button', { name: ar ? 'فتح الجائزة' : 'Open their prize!', exact: true }).click();
}

for (const ar of [true]) for (const width of [1440, 390, 360]) {
  test(`recipient-first duplicate winner draw ${ar ? 'ar' : 'en'} ${width}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: width === 1440 ? 900 : 667 });
    const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
    await start(page, ar);
    await prizes(page, ar);
    await expect(page.locator('.mg-winners-sidebar')).toContainText(ar ? 'لا يوجد فائزون بعد' : 'No winners yet');
    await expect(page.locator('.mg-prize-card').first()).toBeEnabled();
    await page.screenshot({ path: info.outputPath('empty.png'), fullPage: true });
    await page.getByRole('button', { name: ar ? 'عودة' : 'Back to event', exact: true }).click();
    const name = ar ? 'سارة' : 'Sara';
    await add(page, ar, name); await add(page, ar, name);
    await page.getByRole('button', { name: new RegExp(ar ? '^الفائزون' : '^Winners') }).click();
    await expect(page.locator('.mg-management .mg-winner-row')).toHaveCount(2);
    await page.getByRole('button', { name: `${ar ? 'تعديل' : 'Edit'} ${name} #2`, exact: true }).click();
    await page.locator('#mg-edit-name').fill(ar ? 'علي' : 'Ali');
    await page.getByRole('button', { name: ar ? 'حفظ' : 'Save changes', exact: true }).click();
    await expect(page.getByRole('button', { name: `${ar ? 'تعديل' : 'Edit'} ${ar ? 'علي' : 'Ali'} #2`, exact: true })).toBeFocused();
    await expect(page.locator('[data-winner-id="winner-1"]')).toContainText(name);
    const newName = ar ? 'علي' : 'Ali';
    await page.getByRole('button', { name: `${ar ? 'تعديل' : 'Edit'} ${newName} #2`, exact: true }).click();
    await page.locator('#mg-edit-name').fill(name);
    await page.getByRole('button', { name: ar ? 'حفظ' : 'Save changes', exact: true }).click();
    await page.screenshot({ path: info.outputPath('management.png'), fullPage: true });
    await page.keyboard.press('Escape');
    await prizes(page, ar);
    await expect(page.locator('.mg-prize-card').first()).toBeDisabled();
    const second = page.locator('.mg-winners-sidebar [data-winner-id="winner-2"] .mg-winner-option');
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
    await page.getByRole('button', { name: ar ? 'اللي بعده' : 'Continue draw', exact: true }).click();
    await expect(second).toBeDisabled();
    await expect(page.locator('.mg-prize-card').first()).toContainText(name);
    await expect(page.getByRole('checkbox', { name: ar ? 'مؤثرات الاحتفال' : 'Celebration effects' })).toHaveCount(0);
    await page.locator('.mg-winners-sidebar [data-winner-id="winner-1"] .mg-winner-option').click();
    await page.locator('.mg-prize-card').nth(1).click(); await confirm(page, ar);
    await expect(page.locator('.mg-confetti')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(page.locator('.mg-draw-status')).toContainText(ar ? 'يمكنك فتح بطاقات الجوائز المتبقية' : 'You may reveal the remaining prize cards');
    await expect(page.locator('.mg-prize-card').nth(2)).toBeEnabled();
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
  await page.getByRole('button', { name: 'انهاء', exact: true }).click();
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
  const last = page.locator('.mg-winners-sidebar [data-winner-id="winner-8"] .mg-winner-option');
  await last.click(); await expect(last).toHaveAttribute('aria-pressed', 'true');
  await page.locator('.mg-prize-card').last().scrollIntoViewIfNeeded();
  await expect(page.locator('.mg-draw-status')).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBeTruthy();
  await page.locator('.mg-prize-card').last().click();
  await expect(page.locator('.mg-award-confirm')).toContainText('س'.repeat(80));
  await expect(page.getByRole('button', { name: 'فتح الجائزة', exact: true })).toBeInViewport();
});

test('deleting an awarded record explains and restores only its prize', async ({ page }) => {
  await start(page, true); await add(page, true, 'سارة'); await add(page, true, 'سارة');
  await prizes(page, true); await page.locator('.mg-winner-option').first().click();
  await page.locator('.mg-prize-card').first().click(); await confirm(page, true);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /^الفائزون/ }).click();
  await page.locator('.mg-management').getByRole('button', { name: 'حذف سارة #1', exact: true }).click();
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
  await expect(page.getByRole('button',{name:'اللي بعده',exact:true})).toBeFocused();
  await page.keyboard.press('Escape');
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.locator('.mg-winner-option:not(:disabled)').click(); await page.locator('.mg-prize-card').nth(1).click(); await confirm(page,true);
  await expect(page.locator('.mg-reveal-experience')).toHaveAttribute('data-stage','revealed');
  await expect(page.locator('.mg-result-prize')).toHaveText(/^هدية (أولى|ثانية|ثالثة)$/);
  expect(await page.locator('.mg-result-prize').textContent()).not.toBe(firstAward);
  await expect(page.locator('.mg-anticipation, .mg-confetti')).toHaveCount(0);
});

test('winners + icon, deletion confirmation and automatic reveal of leftover prize cards', async ({page},info) => {
  await page.setViewportSize({width:390,height:844});
  await page.emulateMedia({reducedMotion:'reduce'});
  await start(page,true,'Gift one\nGift two\nGift three');
  await prizes(page,true);
  const plus=page.locator('.mg-winners-sidebar .mg-add-winner');
  await expect(plus).toHaveAccessibleName('إضافة فائز');
  await expect(plus.locator('svg')).toBeVisible();
  await expect(page.getByRole('button',{name:'فتح دون اسم',exact:true})).toHaveCount(0);
  await expect(page.getByRole('checkbox',{name:'مؤثرات الاحتفال'})).toHaveCount(0);

  await plus.click();
  await page.locator('#mg-add-name').fill('Sara');
  await page.getByRole('button',{name:'إضافة فائز',exact:true}).click();
  await expect(page.getByRole('button',{name:'تعديل Sara #1',exact:true})).toBeFocused();
  await page.locator('.mg-management .mg-add-winner').click();
  await page.locator('#mg-add-name').fill('Ali');
  await page.getByRole('button',{name:'إضافة فائز',exact:true}).click();
  await page.keyboard.press('Escape');
  // A delete from the sidebar is never immediate; cancellation preserves the record.
  await page.locator('.mg-winners-sidebar').getByRole('button',{name:'حذف Sara #1',exact:true}).click();
  await expect(page.locator('.mg-management')).toContainText('حذف سجل الفائز');
  await page.getByRole('button',{name:'إلغاء',exact:true}).click();
  await page.keyboard.press('Escape');
  await expect(page.locator('.mg-winners-sidebar [data-winner-id="winner-1"]')).toBeVisible();
  await page.locator('.mg-winners-sidebar').getByRole('button',{name:'حذف Sara #1',exact:true}).click();
  await page.getByRole('button',{name:'تأكيد الحذف',exact:true}).click();
  await expect(page.locator('.mg-management [data-winner-id="winner-1"]')).toHaveCount(0);
  await page.locator('.mg-management .mg-add-winner').click();
  await page.locator('#mg-add-name').fill('Sara');
  await page.getByRole('button',{name:'إضافة فائز',exact:true}).click();
  await expect(page.locator('.mg-management [data-winner-id="winner-3"]')).toContainText('Sara');
  await page.keyboard.press('Escape');

  // One card per winner first. No unclaimed card may be opened while an
  // eligible winner has not yet received a prize.
  await page.locator('.mg-winners-sidebar .mg-winner-option:not(:disabled)').first().click();
  await page.locator('.mg-prize-card').nth(0).click(); await confirm(page,true);
  await page.keyboard.press('Escape');
  await expect(page.locator('.mg-prize-card').nth(2)).toBeDisabled();
  await page.locator('.mg-winners-sidebar .mg-winner-option:not(:disabled)').first().click();
  await page.locator('.mg-prize-card').nth(1).click(); await confirm(page,true);
  await page.keyboard.press('Escape');

  await expect(page.locator('.mg-draw-status')).toContainText('يمكنك فتح بطاقات الجوائز المتبقية');
  await expect(page.locator('.mg-prize-card').nth(2)).toBeEnabled();
  await page.locator('.mg-prize-card').nth(2).click();
  await expect(page.locator('.mg-award-confirm')).toContainText('لن ترتبط بأي اسم');
  await page.keyboard.press('Escape');
  await expect(page.locator('.mg-prize-card').nth(2)).toHaveAttribute('data-revealed','false');
  await page.locator('.mg-prize-card').nth(2).click();
  await page.getByRole('button',{name:'فتح الجائزة',exact:true}).click();
  await expect(page.locator('.mg-result-prize')).toHaveText(/^Gift (one|two|three)$/);
  const revealedUnnamed=(await page.locator('.mg-result-prize').textContent())!;
  await expect(page.locator('.mg-result-winner')).toContainText('دون تخصيص اسم');
  await page.screenshot({path:info.outputPath('remaining-auto-open.png'),fullPage:true});
  await page.keyboard.press('Escape');
  await expect(page.locator('.mg-prize-card').nth(2)).toContainText('دون اسم');
  await page.getByRole('button',{name:'انهاء',exact:true}).click();
  await page.getByRole('button',{name:'إنهاء وعرض النتائج',exact:true}).click();
  await expect(page.locator('.mg-unnamed-results')).toContainText(revealedUnnamed);
  await expect(page.locator('.mg-results')).toContainText('Ali');
  await expect(page.locator('.mg-results')).toContainText('Sara');
});

test('all prizes can be manually opened with an empty winner list', async ({page}) => {
  await page.emulateMedia({reducedMotion:'reduce'});await start(page,true,'هدية');await prizes(page,true);
  await expect(page.locator('.mg-prize-card')).toBeEnabled();
  await page.locator('.mg-prize-card').click();await page.getByRole('button',{name:'فتح الجائزة',exact:true}).click();
  await expect(page.locator('.mg-result-prize')).toHaveText('هدية');
  await page.keyboard.press('Escape');await expect(page.locator('.mg-winner-option')).toHaveCount(0);
  await expect(page.locator('.mg-prize-card')).toBeDisabled();
});

test('winner utility controls retain Arabic names and toast feedback inside the active dialog',async({page})=>{
 await start(page,true);await prizes(page,true);
 const addWinner=page.getByRole('button',{name:'إضافة فائز',exact:true});
 await expect(addWinner).toHaveClass(/bud-utility/);
 await addWinner.click();await page.locator('#mg-add-name').fill('سارة');
 await page.getByRole('button',{name:'إضافة فائز',exact:true}).click();
 const dialog=page.locator('.mg-management');
 await expect(dialog.locator('.bud-toast')).toContainText('أُضيف الفائز.');
 const edit=dialog.getByRole('button',{name:'تعديل سارة #1',exact:true});await expect(edit).toHaveClass(/bud-utility/);
 await edit.click();await page.getByLabel(/تعديل اسم الفائز/).fill('نورة');await page.getByRole('button',{name:'حفظ',exact:true}).click();
 await expect(dialog.locator('.bud-toast').last()).toContainText('عُدّل اسم الفائز.');
 await dialog.getByRole('button',{name:'حذف نورة #1',exact:true}).click();await page.getByRole('button',{name:'تأكيد الحذف',exact:true}).click();
 await expect(dialog.locator('.bud-toast').last()).toContainText('حُذف الفائز.');
 await dialog.getByRole('button',{name:'إغلاق',exact:true}).click();
 await expect(page.locator('.bud-toast').last()).toContainText('حُذف الفائز.');
});
