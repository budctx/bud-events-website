import assert from 'node:assert/strict';
import test from 'node:test';
import { initialState, previewReducer } from '../src/preview-state.ts';
test('either reveal order starts exactly one deadline after both cards', () => {
  for (const first of ['question', 'condition'] as const) {
    let s = previewReducer(initialState(7), { type: 'reveal', card: first, now: 100 });
    assert.equal(s.deadline, null);
    s = previewReducer(s, { type: 'reveal', card: first === 'question' ? 'condition' : 'question', now: 300 });
    assert.equal(s.deadline, 7300);
    s = previewReducer(s, { type: 'reveal', card: first, now: 500 });
    assert.equal(s.deadline, 7300);
  }
});
test('zero awaits judgment and a failed retry gets two fresh hidden cards', () => {
  let s = initialState(5, 2);
  s = previewReducer(s, { type: 'judge', correct: true });
  assert.equal(s.outcome, null);
  s = previewReducer(s, { type: 'reveal', card: 'question', now: 0 });
  s = previewReducer(s, { type: 'reveal', card: 'condition', now: 0 });
  s = previewReducer(s, { type: 'tick', now: 100000 });
  assert.equal(s.seconds, 0); assert.equal(s.outcome, null);
  s = previewReducer(s, { type: 'judge', correct: false });
  assert.equal(s.attempt, 2); assert.equal(s.question, false); assert.equal(s.condition, false);
  assert.equal(s.deadline, null); assert.equal(s.seconds, 5);
});
test('judgment is terminal and cannot award prizes or mutate an ended challenge', () => {
  let s = initialState();
  s = previewReducer(s, { type: 'reveal', card: 'question', now: 0 });
  s = previewReducer(s, { type: 'reveal', card: 'condition', now: 0 });
  s = previewReducer(s, { type: 'judge', correct: true });
  assert.equal(s.outcome, 'qualified'); assert.equal(s.deadline, null);
  assert.equal(previewReducer(s, { type: 'judge', correct: false }), s);
  assert.equal('award' in s, false);
});
