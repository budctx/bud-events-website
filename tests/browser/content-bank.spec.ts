import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { bank as publicFixture } from '../fixtures/content-bank.mjs';
// Public CI uses synthetic content. Operators opt into local/private commercial card typography explicitly.
const bank = process.env.BUD_CONTENT_REVIEW_DIR
  ? JSON.parse(readFileSync(resolve(process.env.BUD_CONTENT_REVIEW_DIR, 'bank.json'), 'utf8')) : publicFixture;
const ok = (data: unknown) => ({ status: 200, json: { code: 'OK', data } });

for (const locale of ['ar', 'en'] as const) for (const width of [320, 390, 1440]) {
  test(`card typography ${bank.version} fits existing host cards ${locale} ${width}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 844 }); await page.emulateMedia({ reducedMotion: 'reduce' });
    const cards = { question: bank.questions[0][locale], condition: bank.conditions[0][locale] };
    const event = { eventId: 'content-review-fixture', title: 'Content review fixture', phase: 'active', version: 1,
      cards, cardsEn: cards, serverNow: Date.now(), state: { phase: 'live', config: { duration: 5, timerEnabled: false, attempts: 1 },
        prizes: [{ id: 'prize-1', name: 'Fixture', revealed: false, winnerId: null }], winners: [], nextWinnerNumber: 1,
        question: true, condition: true, attempt: 1, round: 0, deadline: null, remaining: 5, pendingWinner: false } };
    await page.route('**/api/auth?action=session', route => route.fulfill(ok({ id: 'host-1', displayName: 'Content reviewer', avatarUrl: '' })));
    await page.route('**/api/host', route => {
      const action = route.request().postDataJSON().action;
      return route.fulfill(ok(action === 'dashboard' ? { credits: 0, events: [event], products: [], contentVersions: [] } : event));
    });
    await page.goto('/?screen=events&lang=' + locale);
    await page.getByRole('button', { name: locale === 'ar' ? 'استكمال الفعالية' : 'Resume event', exact: true }).click();
    // The existing game is lazy-loaded; allow module startup before measuring, without relaxing any fit assertion.
    await expect(page.locator('.mg-card--question .mg-card-content')).toHaveText(cards.question, { timeout: 15000 });
    const fontProof = await page.evaluate(async locale => {
      const sample = locale === 'ar' ? 'سؤال وشرط' : 'Question and Condition';
      const faces = await document.fonts.load('16px "Readex Pro Variable"', sample);
      await document.fonts.ready;
      return { loaded: faces.some(face => face.status === 'loaded' && face.family.includes('Readex Pro Variable')),
        family: getComputedStyle(document.querySelector('.mg-card-content')!).fontFamily };
    }, locale);
    expect(fontProof.loaded).toBe(true); expect(fontProof.family).toContain('Readex Pro Variable');
    // Isolated typography proof: render each proposed label in the existing revealed-card DOM.
    // This intentionally does not assert publication, server content binding or payment readiness.
    const failures = await page.evaluate(({ questions, conditions, locale }) => {
      const failures: string[] = [];
      for (const [kind, labels] of [['question', questions], ['condition', conditions]] as const) {
        const card = document.querySelector('.mg-card--' + kind)!;
        const content = card.querySelector<HTMLElement>('.mg-card-content')!;
        const face = card.querySelector<HTMLElement>('.mg-card-visible')!;
        for (const label of labels) {
          content.textContent = label[locale];
          const text = content.getBoundingClientRect(), rect = face.getBoundingClientRect();
          const title = face.querySelector('.mg-face-title')!.getBoundingClientRect();
          const footer = face.querySelector('.mg-face-footer')!.getBoundingClientRect();
          if (text.left < rect.left - 1 || text.right > rect.right + 1 || text.top < title.bottom + 1 || text.bottom > footer.top - 1
            || content.scrollWidth > content.clientWidth + 1 || content.scrollHeight > content.clientHeight + 1)
            failures.push(kind + ': ' + label.id + ': ' + locale);
        }
        content.textContent = labels.reduce((a, b) => a[locale].length > b[locale].length ? a : b)[locale];
      }
      return failures;
    }, { questions: bank.questions, conditions: bank.conditions, locale });
    expect(failures).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: info.outputPath(`candidate-cards-${locale}-${width}.png`), fullPage: true, animations: 'disabled' });
  });
}
