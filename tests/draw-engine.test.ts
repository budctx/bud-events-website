import assert from 'node:assert/strict';
import test from 'node:test';
import { approveNewCycle, drawNext, initialDrawState, validateCatalog } from '../src/draw-engine.ts';
import type { PairId } from '../src/draw-engine.ts';

const catalog: PairId[] = [['animal', 'starts-m'], ['animal', 'ends-y'], ['food', 'starts-m'], ['food', 'ends-y'], ['city', 'starts-m'], ['city', 'ends-y']];
const safeRandom = () => 0.5;

test('all approved pairs appear once per cycle; no silent recycle', () => {
  let state = initialDrawState();
  const seen = new Set<string>();
  for (let i = 0; i < catalog.length; i++) {
    const result = drawNext(catalog, state, safeRandom);
    assert.equal(result.kind, 'drawn');
    if (result.kind !== 'drawn') throw Error('Expected draw');
    state = result.state;
    seen.add(result.record.pair.join(':'));
    assert.equal(result.record.index, i + 1);
  }
  assert.equal(seen.size, catalog.length);
  const done = drawNext(catalog, state);
  assert.equal(done.kind, 'exhausted');
  assert.equal(done.state.awaitingNewCycle, true);
  assert.equal(drawNext(catalog, done.state).kind, 'exhausted');
  assert.throws(() => approveNewCycle(state), /CYCLE_NOT_EXHAUSTED/);
  const nextCycle = approveNewCycle(done.state);
  assert.equal(nextCycle.cycle, 2);
  assert.equal(nextCycle.history.length, catalog.length);
  const restarted = drawNext(catalog, nextCycle, safeRandom);
  assert.equal(restarted.kind, 'drawn');
  if (restarted.kind === 'drawn') assert.equal(restarted.record.cycle, 2);
});

test('no immediately repeated question when a different one is available', () => {
  let state = initialDrawState();
  let previous: string | undefined;
  for (let i = 0; i < 4; i++) {
    const result = drawNext(catalog, state, safeRandom);
    if (result.kind !== 'drawn') throw Error('unexpected exhaustion');
    assert.notEqual(result.record.pair[0], previous);
    previous = result.record.pair[0];
    state = result.state;
  }
});

test('balanced question and condition usage prevents early skew', () => {
  let state = initialDrawState();
  for (let i = 0; i < 3; i++) {
    const result = drawNext(catalog, state, safeRandom);
    if (result.kind !== 'drawn') throw Error('unexpected exhaustion');
    state = result.state;
  }
  assert.equal(new Set(state.history.map(x => x.pair[0])).size, 3);
});

test('serializing the snapshot preserves used pairs on resume', () => {
  const first = drawNext(catalog, initialDrawState(), safeRandom);
  if (first.kind !== 'drawn') throw Error('unexpected exhaustion');
  const resumed = JSON.parse(JSON.stringify(first.state));
  const second = drawNext(catalog, resumed, safeRandom);
  if (second.kind !== 'drawn') throw Error('unexpected exhaustion');
  assert.notDeepEqual(second.record.pair, first.record.pair);
  assert.equal(second.state.history.length, 2);
  assert.deepEqual(first.state.history.length, 1);
});

test('supports manually curated compatibility subsets without inventing pairs', () => {
  const subset: PairId[] = [['animal', 'starts-m'], ['city', 'ends-y']];
  let state = initialDrawState();
  const generated: string[] = [];
  for (let i = 0; i < 2; i++) {
    const result = drawNext(subset, state, safeRandom);
    if (result.kind !== 'drawn') throw Error('unexpected exhaustion');
    generated.push(result.record.pair.join(':'));
    state = result.state;
  }
  assert.deepEqual(new Set(generated), new Set(subset.map(p => p.join(':'))));
});

test('rejects duplicate pairs, invalid random and corrupted history', () => {
  assert.throws(() => validateCatalog([]), /EMPTY_OR_OVERSIZED_CATALOG/);
  assert.throws(() => validateCatalog([catalog[0], catalog[0]]), /DUPLICATE_PAIR/);
  assert.throws(() => drawNext(catalog, initialDrawState(), () => 1), /INVALID_RANDOM/);
  const first = drawNext(catalog, initialDrawState(), safeRandom);
  if (first.kind !== 'drawn') throw Error('unexpected exhaustion');
  const broken = { ...first.state, history: [first.record, first.record] };
  assert.throws(() => drawNext(catalog, broken), /REPEATED_PAIR_IN_CYCLE/);
});


test('rehearses 20 consecutive draws from a 23-by-15 eligible catalog', () => {
  const twentyThreeByFifteen: PairId[] = Array.from({ length: 23 }, (_, question) =>
    Array.from({ length: 15 }, (_, condition): PairId => [`q-${question + 1}`, `c-${condition + 1}`])).flat();
  let state = initialDrawState();
  const pairs = new Set<string>();
  for (let round = 0; round < 20; round++) {
    const result = drawNext(twentyThreeByFifteen, state, safeRandom);
    assert.equal(result.kind, 'drawn');
    if (result.kind !== 'drawn') throw Error('unexpected exhaustion');
    const key = result.record.pair.join(':');
    assert.equal(pairs.has(key), false);
    pairs.add(key);
    if (round) assert.notEqual(result.record.pair[0], state.history.at(-1)?.pair[0]);
    state = JSON.parse(JSON.stringify(result.state));
  }
  assert.equal(pairs.size, 20);
  assert.equal(state.history.length, 20);
  assert.equal(state.awaitingNewCycle, false);
});
