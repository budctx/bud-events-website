import assert from 'node:assert/strict';
import test from 'node:test';
import { actualAwards, canRestart, capacityReached, eventReducer as reduce, initialEventState, unopenedPrizeCount } from '../src/event-core.ts';
import type { EventState } from '../src/event-core.ts';
const fixtures = [{ id: 'local-a', name: 'مشارك تجريبي أ' }, { id: 'local-b', name: 'Local B' }, { id: 'local-c', name: 'Local C' }];
function live(prizeCount = 2): EventState {
  let s = reduce(initialEventState(), { type: 'configure', config: { eventName: 'Local demo', duration: 7, maxAttempts: 2, prizeCount } });
  s = reduce(s, { type: 'setup-next' });
  for (const p of s.prizeDefinitions) s = reduce(s, { type: 'define-prize', prizeId: p.id, name: `Prize ${p.id}` });
  return reduce(s, { type: 'start', now: 100, participants: fixtures });
}
function qualify(s: EventState, id: string): EventState {
  return reduce(reduce(s, { type: 'select-participant', mode: 'manual', id }), { type: 'record-outcome', outcome: 'qualified' });
}
test('setup validates runtime inputs and requires every prize definition before start', () => {
  const initial = initialEventState();
  assert.equal(reduce(initial, { type: 'setup-next' }), initial);
  for (const prizeCount of [-1, 51, 1.5, NaN]) assert.equal(reduce(initial, { type: 'configure', config: { prizeCount } }), initial);
  assert.equal(reduce(initial, { type: 'configure', config: { duration: 8 as 5 } }), initial);
  let s = reduce(initial, { type: 'configure', config: { eventName: 'Demo', prizeCount: 2 } });
  s = reduce(s, { type: 'setup-next' });
  assert.equal(reduce(s, { type: 'start', now: 0 }), s);
  s = reduce(s, { type: 'define-prize', prizeId: 'prize-1', name: 'One' });
  assert.equal(reduce(s, { type: 'start', now: 0 }), s);
  s = reduce(s, { type: 'define-prize', prizeId: 'prize-2', name: 'Two' });
  assert.equal(reduce(s, { type: 'start', now: 0, participants: [{ id: '123456789', name: 'Fake Discord user' }] }), s);
  assert.equal(reduce(s, { type: 'start', now: 0, participants: [fixtures[0], fixtures[0]] }), s);
  const started = reduce(s, { type: 'start', now: 0, participants: fixtures });
  assert.equal(started.stage, 'live');
  assert.equal(reduce(started, { type: 'configure', config: { prizeCount: 0 } }), started);
  assert.equal(reduce(started, { type: 'define-prize', prizeId: 'prize-1', name: 'Changed' }), started);
});
test('random selects only new participants; manual permits losers and excludes qualified', () => {
  let s = live();
  s = reduce(s, { type: 'select-participant', mode: 'random', random: 0 });
  assert.equal(s.activeParticipantId, 'local-a');
  assert.equal(reduce(s, { type: 'show-prizes' }), s);
  assert.equal(reduce(s, { type: 'select-participant', mode: 'manual', id: 'local-b' }), s);
  s = reduce(s, { type: 'record-outcome', outcome: 'exhausted' });
  s = reduce(s, { type: 'select-participant', mode: 'random', random: 0 });
  assert.equal(s.activeParticipantId, 'local-b');
  s = reduce(s, { type: 'record-outcome', outcome: 'exhausted' });
  s = reduce(s, { type: 'select-participant', mode: 'random', random: 0 });
  s = reduce(s, { type: 'record-outcome', outcome: 'exhausted' });
  assert.equal(reduce(s, { type: 'select-participant', mode: 'random', random: 0 }), s);
  s = qualify(s, 'local-a');
  assert.deepEqual(s.qualificationOrder, ['local-a']);
  assert.equal(reduce(s, { type: 'select-participant', mode: 'manual', id: 'local-a' }), s);
  for (const random of [-1, 1, NaN]) assert.equal(reduce(s, { type: 'select-participant', mode: 'random', random }), s);
});
test('qualification order and capacity are stable; extra rounds require explicit no-winner confirmation', () => {
  let s = qualify(live(1), 'local-b');
  assert.equal(capacityReached(s), true);
  assert.equal(reduce(s, { type: 'select-participant', mode: 'manual', id: 'local-a' }), s);
  s = reduce(s, { type: 'select-participant', mode: 'manual', id: 'local-a', confirmNoWinner: true });
  assert.equal(s.activeRoundNoWinner, true);
  s = reduce(s, { type: 'record-outcome', outcome: 'qualified' });
  assert.deepEqual(s.qualificationOrder, ['local-b']);
  assert.equal(s.rounds.at(-1)?.outcome, 'no-winner');
  let zero = qualify(live(0), 'local-a');
  zero = qualify(zero, 'local-b');
  assert.deepEqual(zero.qualificationOrder, ['local-a', 'local-b']);
  assert.equal(capacityReached(zero), false);
  assert.deepEqual(actualAwards(zero), []);
});
test('opening requires confirmation and explicit qualified winner; commits cannot change and lock return/restart', () => {
  let s = qualify(live(), 'local-b');
  s = qualify(s, 'local-a');
  s = reduce(s, { type: 'show-prizes' });
  assert.equal(reduce(s, { type: 'open-prize', prizeId: 'prize-1', winnerId: 'local-b', confirmed: false }), s);
  assert.equal(reduce(s, { type: 'open-prize', prizeId: 'prize-1', winnerId: 'local-c', confirmed: true }), s);
  s = reduce(s, { type: 'open-prize', prizeId: 'prize-1', winnerId: 'local-a', confirmed: true });
  assert.deepEqual(s.awards, [{ prizeId: 'prize-1', winnerId: 'local-a' }]);
  assert.equal(reduce(s, { type: 'back-live' }), s);
  assert.equal(canRestart(s, 200), false);
  assert.equal(reduce(s, { type: 'open-prize', prizeId: 'prize-1', winnerId: 'local-b', confirmed: true }), s);
  assert.equal(reduce(s, { type: 'open-prize', prizeId: 'prize-2', winnerId: 'local-a', confirmed: true }), s);
  s = reduce(s, { type: 'open-prize', prizeId: 'prize-2', winnerId: null, confirmed: true });
  assert.equal(unopenedPrizeCount(s), 0);
  assert.equal(actualAwards(s).length, 1);
});
test('closing warns unopened, can return to prizes, and final completion rejects every mutation', () => {
  let s = reduce(live(), { type: 'show-prizes' });
  assert.equal(reduce(s, { type: 'closing' }), s);
  s = reduce(s, { type: 'closing', confirmed: true });
  assert.equal(s.stage, 'closing');
  assert.equal(canRestart(s, 200), false);
  assert.equal(reduce(s, { type: 'complete', confirmed: false }), s);
  s = reduce(s, { type: 'back-prizes' });
  assert.equal(s.stage, 'prizes');
  s = reduce(s, { type: 'closing', confirmed: true });
  s = reduce(s, { type: 'complete', confirmed: true });
  assert.equal(s.stage, 'completed');
  assert.deepEqual(s.participants, []); assert.deepEqual(s.rounds, []);
  assert.deepEqual(s.qualificationOrder, []); assert.deepEqual(s.prizeDefinitions, []);
  assert.equal(reduce(s, { type: 'back-prizes' }), s);
  assert.equal(reduce(s, { type: 'restart', now: 200, confirmed: true }), s);
  assert.equal(reduce(s, { type: 'add-participant', id: 'local-d', name: 'D' }), s);
  assert.equal(reduce(s, { type: 'open-prize', prizeId: 'prize-1', winnerId: null, confirmed: true }), s);
});
test('one restart within original hour clears inputs/history but retains clock and marker', () => {
  let s = qualify(live(), 'local-a');
  assert.equal(canRestart(s, 99), false);
  assert.equal(canRestart(s, 100 + 3599999), true);
  assert.equal(canRestart(s, 100 + 3600000), false);
  assert.equal(canRestart(s, 100 + 3600001), false);
  assert.equal(reduce(s, { type: 'restart', now: 200, confirmed: false }), s);
  s = reduce(s, { type: 'restart', now: 200, confirmed: true });
  assert.equal(s.stage, 'setup-basics');
  assert.equal(s.startedAt, 100); assert.equal(s.restartUsed, true);
  assert.equal(s.config.eventName, ''); assert.deepEqual(s.prizeDefinitions, []);
  assert.deepEqual(s.participants, []); assert.deepEqual(s.rounds, []);
  s = reduce(s, { type: 'configure', config: { eventName: 'Retry' } });
  s = reduce(s, { type: 'setup-next' });
  s = reduce(s, { type: 'start', now: 1000, participants: fixtures });
  assert.equal(s.startedAt, 100);
  assert.equal(reduce(s, { type: 'restart', now: 1200, confirmed: true }), s);
});

test('zero-prize restart is available only in live stage', () => {
  const s = live(0);
  assert.equal(canRestart(s, 200), true);
  assert.equal(canRestart(reduce(s, { type: 'show-prizes' }), 200), false);
});
test('final local snapshot contains only awarded results, not losing or unawarded participant inputs', () => {
  let s = qualify(live(2), 'local-a');
  s = qualify(s, 'local-b');
  s = reduce(s, { type: 'show-prizes' });
  s = reduce(s, { type: 'open-prize', prizeId: 'prize-2', winnerId: 'local-b', confirmed: true });
  s = reduce(s, { type: 'open-prize', prizeId: 'prize-1', winnerId: null, confirmed: true });
  s = reduce(s, { type: 'closing' });
  s = reduce(s, { type: 'complete', confirmed: true });
  assert.deepEqual(s.participants.map(p => p.id), ['local-b']);
  assert.deepEqual(s.prizeDefinitions.map(p => p.id), ['prize-2']);
  assert.deepEqual(s.awards, [{ prizeId: 'prize-2', winnerId: 'local-b' }]);
  assert.deepEqual(s.rounds, []); assert.deepEqual(s.qualificationOrder, ['local-b']);
});

test('completion preserves relative qualification order when winners choose prizes in reversed order', () => {
  let s = qualify(live(2), 'local-a');
  s = qualify(s, 'local-b');
  s = reduce(s, { type: 'show-prizes' });
  s = reduce(s, { type: 'open-prize', prizeId: 'prize-1', winnerId: 'local-b', confirmed: true });
  s = reduce(s, { type: 'open-prize', prizeId: 'prize-2', winnerId: 'local-a', confirmed: true });
  s = reduce(s, { type: 'closing' });
  s = reduce(s, { type: 'complete', confirmed: true });
  assert.deepEqual(s.qualificationOrder, ['local-a', 'local-b']);
  assert.deepEqual(s.awards.map(a => a.winnerId), ['local-b', 'local-a']);
});
