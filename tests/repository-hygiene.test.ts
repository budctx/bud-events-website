import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

test('public entrypoint uses the platform and keeps host tools development-only', () => {
  const app = read('src/App.tsx');
  const main = read('src/main.tsx');
  const game = read('src/Game.tsx');
  const platform = read('src/Platform.tsx');
  assert.match(app, /import Platform from '.\/Platform'/);
  assert.match(app, /import\.meta\.env\.DEV \? lazy/);
  assert.match(app, /import\('\.\/Game'\)/);
  assert.doesNotMatch(platform, /onPlay/);
  assert.match(game, /manualGameReducer/);
  assert.match(platform, /platform-product-card/);
  for (const s of [app,main,game,platform]) {
    assert.doesNotMatch(s, /(?:FoundationPreview|event-core|preview-state|journey-copy|components\/Icon|components\/Button)/);
  }
});

test('superseded participant era sources and unused failing browser suites are removed from active repo', () => {
  const retired = [
    'src/FoundationPreview.tsx', 'src/event-core.ts', 'src/preview-state.ts', 'src/journey-copy.ts',
    'src/components/Button.tsx', 'src/components/Icon.tsx', 'src/components/PlayingCard.tsx',
    'tests/browser/preview.spec.ts', 'tests/browser/journey.spec.ts',
    'tests/event-core.test.ts', 'tests/state.test.ts'
  ];
  for (const path of retired) assert.equal(existsSync(join(root, path)),false,path+' must remain archived only in Git');
  assert.match(read('src/i18n.ts'), /export type Locale = 'ar' \| 'en'/);
});

test('production source of truth and archive are clear to future agents', () => {
  const readme = read('README.md');
  const agents = read('AGENTS.md');
  const archive = read('docs/BUD_REPOSITORY_ARCHIVE.md');
  assert.match(readme, /https:\/\/bud-events-website\.vercel\.app/);
  assert.match(readme, /Notion/);
  assert.match(readme, /No Discord bot, participant registration\/tracking/);
  assert.match(agents, /Stage 00/);
  assert.match(archive, /7cb565cdbbfd9d0414271baf27a61ff1fd958bf3/);
  for(const path of ['docs/implementation.md','docs/verification.md','docs/bot-impact-study.md']) {
    assert.match(read(path), /^> \*\*ARCHIVED/);
  }
});

test('deployment and governance still fail closed for payment and stage sign-off', () => {
  assert.match(read('api/commerce.ts'), /handleCommerce/);
  assert.match(read('.github/workflows/ci.yml'), /npm test/);
  const manifest = read('package.json');
  assert.match(manifest, /tests\/browser\/production\.spec\.ts/);
  const evidence = read('scripts/sync-notion-ci.mjs');
  assert.match(evidence, /Historical evidence/);
  assert.match(evidence, /already-present/);
});
