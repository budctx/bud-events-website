import test from 'node:test';
import assert from 'node:assert/strict';
import {
  browserCards, prepareBrowserRun, readBrowserRun, restoreBrowserRun,
  saveBrowserRun, selectBrowserRun, stepBrowserRun,
} from '../src/browser-event.ts';

class FixtureStorage {
  data = new Map<string, string>();
  get length() { return this.data.size; }
  key(index: number) { return [...this.data.keys()][index] ?? null; }
  getItem(name: string) { return this.data.get(name) ?? null; }
  setItem(name: string, value: string) { this.data.set(name, value); }
  removeItem(name: string) { this.data.delete(name); }
  clear() { this.data.clear(); }
}
const local = new FixtureStorage();
const session = new FixtureStorage();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: local });
Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: session });

const content = {
  version: 'fixture-rehearsal-v1',
  questions: Array.from({length: 5}, (_, i) => `سؤال ${i + 1}`),
  conditions: Array.from({length: 5}, (_, i) => `شرط ${i + 1}`),
  pairs: Array.from({length: 5}, (_, q) =>
    Array.from({length: 5}, (_, c): [string, string] => [String(q), String(c)])).flat(),
};
const pkg = {
  ownerId: 'fixture-owner',
  eventId: 'fixture-event',
  title: 'بروفة محلية بدون شراء',
  expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
  content,
  legacy: null,
};
const start = {
  action: 'start' as const,
  idempotencyKey: 'synthetic-rehearsal',
  title: pkg.title,
  config: {duration: 5, timerEnabled: true, attempts: 1 as const},
  prizeText: 'جائزة 1\nجائزة 2\nجائزة 3\nجائزة 4',
};

test('20 complete local rounds persist, never repeat a pair and award four distinct prizes', () => {
  local.clear();
  session.clear();
  let run = prepareBrowserRun(pkg, start);
  selectBrowserRun(run);
  const seen = new Set<string>();
  const base = Date.now();

  for (let index = 0; index < 20; index++) {
    const shown = browserCards(run);
    assert.ok(shown.question.length > 0 && shown.condition.length > 0);
    const current = run.state.activityDraw?.current?.pair;
    assert.ok(current);
    const pair = current.join(':');
    assert.equal(seen.has(pair), false, `duplicate pair in round ${index + 1}`);
    seen.add(pair);

    const now = base + index * 7000;
    run = stepBrowserRun(run, {type: 'reveal', card: 'question', now}, now);
    assert.equal(run.state.deadline, null);
    run = stepBrowserRun(run, {type: 'reveal', card: 'condition', now: now + 200}, now + 200);
    assert.equal(run.state.deadline, now + 5200);
    assert.equal(run.state.round, index);

    if (index % 5 === 0) {
      run = stepBrowserRun(run, {type: 'correct'}, now + 300);
      assert.equal(run.state.pendingWinner, true);
      run = stepBrowserRun(run, {type: 'save-winner', name: index <= 5 ? 'سارة' : `الفائز ${index}`}, now + 400);
    } else {
      run = stepBrowserRun(run, {type: 'wrong'}, now + 400);
    }

    assert.equal(run.state.round, index + 1);
    assert.equal(run.state.deadline, null);
    assert.ok(saveBrowserRun(run), `local save failed in round ${index + 1}`);
    assert.deepEqual(readBrowserRun(pkg.ownerId, pkg.eventId), run);
    assert.deepEqual(restoreBrowserRun(pkg.eventId), run);
    run = readBrowserRun(pkg.ownerId, pkg.eventId)!;
  }

  assert.equal(seen.size, 20);
  assert.equal(run.state.activityDraw?.draw.history.length, 21); // next card drawn for round 21
  assert.equal(run.state.winners.length, 4);
  assert.equal(run.state.winners.filter(w => w.name === 'سارة').length, 2);

  run = stepBrowserRun(run, {type: 'phase', phase: 'prizes'});
  for (let i = 0; i < 4; i++) {
    const prizeId = `prize-${i + 1}`;
    const winnerId = run.state.winners[i].id;
    run = stepBrowserRun(run, {type: 'award', prizeId, winnerId});
    assert.equal(run.state.prizes[i].winnerId, winnerId);
    assert.equal(run.state.prizes[i].revealed, true);
    assert.equal(stepBrowserRun(run, {type: 'award', prizeId, winnerId}), run);
  }
  assert.equal(new Set(run.state.prizes.map(p => p.winnerId)).size, 4);
  run = stepBrowserRun(run, {type: 'phase', phase: 'closing'});
  assert.equal(run.state.phase, 'closing');
  assert.equal(stepBrowserRun(run, {type: 'add-winner', name: 'بعد الإغلاق'}), run);
  assert.ok(saveBrowserRun(run));
  assert.deepEqual(readBrowserRun(pkg.ownerId, pkg.eventId)?.state.prizes, run.state.prizes);
});

test('exhausted local draw requires explicit restart before drawing another cycle', () => {
  local.clear();
  session.clear();
  const tiny = {
    ...pkg,
    eventId: 'exhaustion-rehearsal',
    content: {version:'short-v1', questions:['س1','س2'], conditions:['ش1','ش2'],
      pairs: [['0','0'],['0','1'],['1','0']] as [string,string][]},
  };
  let run = prepareBrowserRun(tiny, {...start, prizeText:''});
  const seen = new Set<string>();
  for (let i = 0; i < 3; i++) {
    const pair = run.state.activityDraw?.current?.pair;
    assert.ok(pair);
    seen.add(pair.join(':'));
    run = stepBrowserRun(run, {type:'reveal', card:'question', now:Date.now()});
    run = stepBrowserRun(run, {type:'reveal', card:'condition', now:Date.now()});
    run = stepBrowserRun(run, {type:'wrong'});
  }
  assert.equal(seen.size, 3);
  assert.equal(run.state.activityDraw?.exhausted, true);
  assert.equal(run.state.activityDraw?.current, null);
  assert.equal(stepBrowserRun(run, {type:'reveal', card:'question', now:Date.now()}), run);
  assert.ok(saveBrowserRun(run));

  run = stepBrowserRun(run, {type:'restart-cycle'});
  assert.equal(run.state.activityDraw?.draw.cycle, 2);
  assert.equal(run.state.activityDraw?.exhausted, false);
  assert.ok(run.state.activityDraw?.current);
  assert.ok(saveBrowserRun(run));
});
