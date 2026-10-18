import assert from 'node:assert/strict';
import test from 'node:test';
import { initialDrawBag, nextPair } from '../src/local-draw.ts';

test('local pair cycle draws every question and condition combination exactly once', () => {
  let bag = initialDrawBag();
  const pairs: string[] = [];
  for (let i = 0; i < 9; i++) {
    const result = nextPair(bag, 3, 3, () => 0.5);
    bag = result.bag;
    pairs.push(result.pair.join(':'));
  }
  assert.equal(new Set(pairs).size, 9);
  assert.equal(bag.remaining.length, 0);
  assert.equal(bag.cycle, 1);
  const again = nextPair(bag, 3, 3, () => 0.5);
  assert.equal(again.bag.cycle, 2);
  assert.equal(again.bag.remaining.length, 8);
});

test('draw rejects empty banks and invalid randomness safely', () => {
  assert.throws(() => nextPair(initialDrawBag(), 0, 3));
  assert.throws(() => nextPair(initialDrawBag(), 3, 0));
  assert.throws(() => nextPair(initialDrawBag(), 3, 3, () => 1));
});
