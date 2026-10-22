import assert from 'node:assert/strict';
import test from 'node:test';
import { initialManualState, manualGameReducer, validDuration } from '../src/manual-game.ts';
import type { ManualState } from '../src/manual-game.ts';
const start = (prizeText = 'First\nSecond', duration = 5, timerEnabled = true): ManualState => manualGameReducer(initialManualState(), { type: 'start', prizeText, config: { duration, attempts: 2, timerEnabled } });
function reveal(state: ManualState) { return manualGameReducer(manualGameReducer(state, { type: 'reveal', card: 'question', now: 100 }), { type: 'reveal', card: 'condition', now: 200 }); }
function save(state: ManualState, name: string) { return manualGameReducer(manualGameReducer(reveal(state), { type: 'correct' }), { type: 'save-winner', name }); }
test('custom timer accepts every integer 3–30 and rejects forged bounds/fractions', () => {
  for (let duration = 3; duration <= 30; duration++) assert.equal(start('', duration).config.duration, duration);
  for (const duration of [2, 31, 5.5, NaN, Infinity]) { assert.equal(validDuration(duration), false); assert.equal(start('', duration).phase, 'setup'); }
});
test('timer starts once after both cards, disabled timer has no deadline, zero never judges', () => {
  let state = start('', 13);
  state = manualGameReducer(state, { type: 'reveal', card: 'condition', now: 10 }); assert.equal(state.deadline, null);
  state = manualGameReducer(state, { type: 'reveal', card: 'question', now: 200 }); assert.equal(state.deadline, 13200);
  assert.equal(manualGameReducer(state, { type: 'reveal', card: 'question', now: 500 }), state);
  state = manualGameReducer(state, { type: 'tick', now: 99999 }); assert.equal(state.remaining, 0); assert.equal(state.winners.length, 0);
  assert.equal(reveal(start('', 5, false)).deadline, null);
});
test('winner is impossible before both cards and correct judgment; replay cannot duplicate winner', () => {
  const state = start();
  assert.equal(manualGameReducer(state, { type: 'correct' }), state);
  assert.equal(manualGameReducer(state, { type: 'save-winner', name: 'A' }), state);
  let next = save(state, '  A  '); assert.equal(next.winners[0]?.name, 'A'); assert.equal(next.question, false);
  assert.equal(manualGameReducer(next, { type: 'save-winner', name: 'B' }), next);
  next = manualGameReducer(reveal(next), { type: 'correct' });
  assert.equal(manualGameReducer(next, { type: 'save-winner', name: 'a' }), next);
  assert.equal(manualGameReducer(next, { type: 'save-winner', name: ' ' }), next);
  assert.equal(manualGameReducer(next, { type: 'save-winner', name: 'x'.repeat(81) }), next);
  assert.equal('participants' in next, false); assert.equal('discordId' in next.winners[0], false);
});
test('capacity caps winners, and retry makes fresh hidden cards without tracking losers', () => {
  let state = start('One');
  state = manualGameReducer(reveal(state), { type: 'wrong' }); assert.equal(state.attempt, 2); assert.equal(state.round, 1);
  state = manualGameReducer(reveal(state), { type: 'wrong' }); assert.equal(state.attempt, 1); assert.equal(state.winners.length, 0);
  state = save(state, 'A');
  const revealed = reveal(state); assert.equal(manualGameReducer(revealed, { type: 'correct' }), revealed);
});
test('prize assignment is winner-only, single-use, and terminal closing prevents mutation', () => {
  let state = save(save(start(), 'A'), 'B');
  state = manualGameReducer(state, { type: 'phase', phase: 'prizes' });
  assert.equal(manualGameReducer(state, { type: 'award', prizeId: 'prize-1', winnerId: 'unknown' }), state);
  state = manualGameReducer(state, { type: 'award', prizeId: 'prize-1', winnerId: 'winner-1' });
  assert.equal(manualGameReducer(state, { type: 'award', prizeId: 'prize-2', winnerId: 'winner-1' }), state);
  assert.equal(manualGameReducer(state, { type: 'phase', phase: 'live' }), state);
  state = manualGameReducer(state, { type: 'phase', phase: 'closing' });
  assert.equal(manualGameReducer(state, { type: 'award', prizeId: 'prize-2', winnerId: 'winner-2' }), state);
  assert.equal(manualGameReducer(state, { type: 'phase', phase: 'prizes' }), state);
  assert.deepEqual(manualGameReducer(state, { type: 'reset' }), initialManualState());
});


test('visiting prizes preserves timer deadline and resume catches elapsed time', () => {
  let s=manualGameReducer(initialManualState(), {type:'start',config:{duration:13,timerEnabled:true,attempts:1},prizeText:'Gift'});
  s=manualGameReducer(s,{type:'reveal',card:'question',now:100});
  s=manualGameReducer(s,{type:'reveal',card:'condition',now:200});
  const deadline=s.deadline;
  s=manualGameReducer(s,{type:'phase',phase:'prizes'});
  s=manualGameReducer(s,{type:'phase',phase:'live'});
  assert.equal(s.deadline,deadline);
  s=manualGameReducer(s,{type:'tick',now:15000});
  assert.equal(s.remaining,0);
});


test('canceling winner entry resumes original deadline without freezing the round', () => {
 let s=reveal(start('Gift',13,true)); const deadline=s.deadline;
 s=manualGameReducer(s,{type:'correct'});
 s=manualGameReducer(s,{type:'cancel-winner'});
 assert.equal(s.deadline,deadline);
 s=manualGameReducer(s,{type:'tick',now:999999});
 assert.equal(s.remaining,0);
});
