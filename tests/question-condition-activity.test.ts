import assert from 'node:assert/strict';
import test from 'node:test';
import { beginQuestionCondition, onQuestionConditionRound, restartQuestionConditionCycle } from '../server/question-condition-activity.ts';
import type { PairId } from '../src/draw-engine.ts';

const pairs: PairId[] = [['animal', 'starts-m'], ['city', 'ends-y'], ['food', 'two-words']];
test('activity adapter persists a single authoritative history and gates exhaustion', () => {
  let step = beginQuestionCondition(pairs, () => 0.5);
  assert.equal(step.activity.round, 0);
  assert.equal(step.activity.draw.history.length, 1);
  for (let round = 1; round <= 2; round++) {
    step = onQuestionConditionRound(step.activity, round, pairs, () => 0.5);
    assert.equal(step.notice, 'drawn');
  }
  const exhausted = onQuestionConditionRound(step.activity, 3, pairs, () => 0.5);
  assert.equal(exhausted.notice, 'exhausted');
  assert.equal(exhausted.activity.current, null);
  assert.equal(exhausted.activity.draw.awaitingNewCycle, true);
  assert.throws(() => onQuestionConditionRound(exhausted.activity, 4, pairs), /HOST_APPROVAL_REQUIRED/);
  const serialized = JSON.parse(JSON.stringify(exhausted.activity));
  const restarted = restartQuestionConditionCycle(serialized, pairs, () => 0.5);
  assert.equal(restarted.activity.draw.cycle, 2);
  assert.equal(restarted.activity.draw.history.length, 4);
  assert.equal(restarted.activity.round, 3);
  assert.equal(restarted.activity.exhausted, false);
});
test('adapter rejects arbitrary phase and round jumps', () => {
  const started = beginQuestionCondition(pairs, () => 0.5);
  assert.throws(() => onQuestionConditionRound(started.activity, 2, pairs), /INVALID_ROUND_TRANSITION/);
  assert.throws(() => restartQuestionConditionCycle(started.activity, pairs), /CYCLE_NOT_EXHAUSTED/);
});
