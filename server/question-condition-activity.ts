// Activity adapter: the shared event engine owns persistence, idempotency,
// host authorization and phases. This module only handles question/condition draws.
// The caller must persist the entire returned activity snapshot with event state
// in the same authoritative transaction.
import { approveNewCycle, drawNext, initialDrawState } from '../src/draw-engine.ts';
import type { PairCatalog } from '../src/draw-engine.ts';
import type { QuestionConditionActivity } from '../src/question-condition-types.ts';

export type ActivityStep = { activity: QuestionConditionActivity; notice: 'drawn' | 'exhausted' };

export function beginQuestionCondition(
  catalog: PairCatalog,
  random?: () => number,
): ActivityStep {
  const result = drawNext(catalog, initialDrawState(), random);
  if (result.kind !== 'drawn') throw new Error('PLAYABLE_CATALOG_REQUIRED');
  return {
    activity: { kind: 'question-condition', draw: result.state, current: result.record, exhausted: false, round: 0 },
    notice: 'drawn',
  };
}

/** Called only after a valid shared-event reducer transition increases round. */
export function onQuestionConditionRound(
  activity: QuestionConditionActivity,
  nextRound: number,
  catalog: PairCatalog,
  random?: () => number,
): ActivityStep {
  if (!Number.isSafeInteger(nextRound) || nextRound !== activity.round + 1) throw new Error('INVALID_ROUND_TRANSITION');
  if (activity.exhausted) throw new Error('HOST_APPROVAL_REQUIRED');
  const next = drawNext(catalog, activity.draw, random);
  if (next.kind === 'exhausted') {
    return { activity: { ...activity, round: nextRound, current: null, exhausted: true, draw: next.state }, notice: 'exhausted' };
  }
  return { activity: { ...activity, round: nextRound, current: next.record, exhausted: false, draw: next.state }, notice: 'drawn' };
}

/** Must be authorized as an explicit command from the host. */
export function restartQuestionConditionCycle(
  activity: QuestionConditionActivity,
  catalog: PairCatalog,
  random?: () => number,
): ActivityStep {
  if (!activity.exhausted || !activity.draw.awaitingNewCycle) throw new Error('CYCLE_NOT_EXHAUSTED');
  const next = drawNext(catalog, approveNewCycle(activity.draw), random);
  if (next.kind !== 'drawn') throw new Error('PLAYABLE_CATALOG_REQUIRED');
  return { activity: { ...activity, current: next.record, draw: next.state, exhausted: false }, notice: 'drawn' };
}
