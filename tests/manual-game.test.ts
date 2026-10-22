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
  const duplicate = manualGameReducer(next, { type: 'save-winner', name: 'a' });
  assert.equal(duplicate.winners.length, 2);
  assert.notEqual(duplicate.winners[0].id, duplicate.winners[1].id);
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

test('duplicate names remain independent through rename, delete, replacement and award', () => {
  let s = save(save(save(start('1\n2\n3\n4'), 'سارة'), 'سارة'), 'علي');
  assert.deepEqual(s.winners.map(w => w.id), ['winner-1', 'winner-2', 'winner-3']);
  s = manualGameReducer(s, { type: 'rename-winner', winnerId: 'winner-3', name: 'سارة' });
  assert.equal(s.winners.filter(w => w.name === 'سارة').length, 3);
  s = manualGameReducer(s, { type: 'delete-winner', winnerId: 'winner-2' });
  s = save(s, 'سارة');
  assert.deepEqual(s.winners.map(w => w.id), ['winner-1', 'winner-3', 'winner-4']);
  s = manualGameReducer(s, { type: 'phase', phase: 'prizes' });
  s = manualGameReducer(s, { type: 'award', prizeId: 'prize-1', winnerId: 'winner-4' });
  assert.equal(s.prizes[0].winnerId, 'winner-4');
  assert.equal(manualGameReducer(s, { type: 'award', prizeId: 'prize-2', winnerId: 'winner-4' }), s);
  s = manualGameReducer(s, { type: 'delete-winner', winnerId: 'winner-1' });
  assert.equal(s.prizes[0].winnerId, 'winner-4');
  s = manualGameReducer(s, { type: 'delete-winner', winnerId: 'winner-4' });
  assert.equal(s.prizes[0].winnerId, null);
  assert.equal(s.prizes[0].revealed, false);
  s = manualGameReducer(s, { type: 'award', prizeId: 'prize-1', winnerId: 'winner-3' });
  assert.equal(s.prizes[0].winnerId, 'winner-3');
});

test('management validates names, phase, unknown IDs and immutable closing results', () => {
  const s = save(start(), 'A');
  for (const name of ['', ' ', 'x'.repeat(81)]) assert.equal(manualGameReducer(s, { type: 'rename-winner', winnerId: 'winner-1', name }), s);
  assert.equal(manualGameReducer(s, { type: 'delete-winner', winnerId: 'missing' }), s);
  const pending = manualGameReducer(reveal(s), { type: 'correct' });
  assert.equal(manualGameReducer(pending, { type: 'delete-winner', winnerId: 'winner-1' }), pending);
  const closed = manualGameReducer(manualGameReducer(s, { type: 'phase', phase: 'prizes' }), { type: 'phase', phase: 'closing' });
  assert.equal(manualGameReducer(closed, { type: 'rename-winner', winnerId: 'winner-1', name: 'B' }), closed);
  assert.equal(manualGameReducer(closed, { type: 'delete-winner', winnerId: 'winner-1' }), closed);
});

test('host additions preserve the round, allow duplicates, enforce capacity and replace deleted records', () => {
  let s = reveal(start('1\n2'));
  const deadline = s.deadline, round = s.round;
  s = manualGameReducer(s, {type:'add-winner',name:'سارة'});
  assert.equal(s.deadline,deadline); assert.equal(s.round,round); assert.equal(s.question,true);
  s = manualGameReducer(s,{type:'phase',phase:'prizes'});
  s = manualGameReducer(s,{type:'add-winner',name:'سارة'});
  assert.deepEqual(s.winners.map(w=>w.id),['winner-1','winner-2']);
  assert.equal(manualGameReducer(s,{type:'add-winner',name:'زائد'}),s);
  s = manualGameReducer(s,{type:'delete-winner',winnerId:'winner-1'});
  s = manualGameReducer(s,{type:'add-winner',name:'بديل'});
  assert.deepEqual(s.winners.map(w=>w.id),['winner-2','winner-3']);
  const closed=manualGameReducer(s,{type:'phase',phase:'closing'});
  assert.equal(manualGameReducer(closed,{type:'add-winner',name:'غير مسموح'}),closed);
  for(const name of ['', ' ', 'x'.repeat(81)]) assert.equal(manualGameReducer(start(),{type:'add-winner',name}).winners.length,0);
});

test('manual opening reveals a prize without creating a winner or allowing replay/terminal mutation', () => {
  let s = start('1\n2');
  assert.equal(manualGameReducer(s,{type:'open-prize',prizeId:'prize-1'}),s);
  s = manualGameReducer(s,{type:'phase',phase:'prizes'});
  s = manualGameReducer(s,{type:'open-prize',prizeId:'prize-1'});
  assert.equal(s.prizes[0].revealed,true); assert.equal(s.prizes[0].winnerId,null); assert.equal(s.winners.length,0);
  assert.equal(manualGameReducer(s,{type:'open-prize',prizeId:'prize-1'}),s);
  assert.equal(manualGameReducer(s,{type:'open-prize',prizeId:'missing'}),s);
  s = manualGameReducer(s,{type:'add-winner',name:'A'});
  assert.equal(manualGameReducer(s,{type:'award',prizeId:'prize-1',winnerId:'winner-1'}),s);
  s = manualGameReducer(s,{type:'award',prizeId:'prize-2',winnerId:'winner-1'});
  s = manualGameReducer(s,{type:'delete-winner',winnerId:'winner-1'});
  assert.equal(s.prizes[0].revealed,true); assert.equal(s.prizes[1].revealed,false);
  s = manualGameReducer(s,{type:'phase',phase:'closing'});
  assert.equal(manualGameReducer(s,{type:'open-prize',prizeId:'prize-2'}),s);
});
