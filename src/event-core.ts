// LOCAL preview only: no server authority, Discord identity, payment or persistence.
import type { Attempts, Duration } from './preview-state.ts';
export type EventStage = 'setup-basics' | 'setup-prizes' | 'live' | 'prizes' | 'closing' | 'completed';
export type Participant = { id: string; name: string; status: 'neverPlayed' | 'lost' | 'qualified' };
export type PrizeDefinition = { id: string; name: string };
export type Award = { prizeId: string; winnerId: string | null };
export type EventConfig = { eventName: string; duration: Duration; maxAttempts: Attempts; prizeCount: number };
export type EventState = {
  source: 'local-preview'; stage: EventStage; config: EventConfig; prizeDefinitions: PrizeDefinition[];
  participants: Participant[]; qualificationOrder: string[]; activeParticipantId: string | null;
  activeRoundNoWinner: boolean; rounds: { participantId: string; outcome: 'qualified' | 'lost' | 'no-winner' }[];
  awards: Award[]; startedAt: number | null; restartUsed: boolean;
};
export type EventAction =
  | { type: 'configure'; config: Partial<EventConfig> }
  | { type: 'define-prize'; prizeId: string; name: string }
  | { type: 'add-participant'; id: string; name: string }
  | { type: 'setup-next' | 'setup-back' }
  | { type: 'start'; now: number; participants?: { id: string; name: string }[] }
  | { type: 'select-participant'; mode: 'manual'; id: string; confirmNoWinner?: boolean }
  | { type: 'select-participant'; mode: 'random'; random: number; confirmNoWinner?: boolean }
  | { type: 'record-outcome'; outcome: 'qualified' | 'exhausted' }
  | { type: 'show-prizes' | 'back-live' | 'back-prizes' }
  | { type: 'open-prize'; prizeId: string; winnerId: string | null; confirmed: boolean }
  | { type: 'closing'; confirmed?: boolean }
  | { type: 'complete'; confirmed: boolean }
  | { type: 'restart'; now: number; confirmed: boolean };
export function initialEventState(): EventState {
  return { source: 'local-preview', stage: 'setup-basics', config: { eventName: '', duration: 5, maxAttempts: 1, prizeCount: 0 },
    prizeDefinitions: [], participants: [], qualificationOrder: [], activeParticipantId: null, activeRoundNoWinner: false,
    rounds: [], awards: [], startedAt: null, restartUsed: false };
}
export function capacityReached(s: EventState): boolean {
  return s.config.prizeCount > 0 && s.qualificationOrder.length >= s.config.prizeCount;
}
export function canRestart(s: EventState, now: number): boolean {
  return Number.isFinite(now) && s.startedAt !== null && now >= s.startedAt && now - s.startedAt < 60 * 60 * 1000
    && !s.restartUsed && s.awards.length === 0 && (s.stage === 'live' || (s.stage === 'prizes' && s.config.prizeCount > 0));
}
export function actualAwards(s: EventState): Award[] { return s.awards.filter(a => a.winnerId !== null); }
export function unopenedPrizeCount(s: EventState): number { return s.prizeDefinitions.length - s.awards.length; }
const validFixture = (p: { id: string; name: string }) => typeof p.id === 'string' && /^local-[a-zA-Z0-9_-]+$/.test(p.id)
  && typeof p.name === 'string' && p.name.trim().length > 0 && p.name.trim().length <= 80;
export function eventReducer(s: EventState, a: EventAction): EventState {
  if (s.stage === 'completed') return s;
  if (a.type === 'restart') {
    if (!a.confirmed || !canRestart(s, a.now)) return s;
    return { ...initialEventState(), startedAt: s.startedAt, restartUsed: true };
  }
  if (a.type === 'configure') {
    if (s.stage !== 'setup-basics') return s;
    const config = { ...s.config, ...a.config };
    if (typeof config.eventName !== 'string' || config.eventName.length > 100 || ![5, 7, 10].includes(config.duration)
      || ![1, 2, 3].includes(config.maxAttempts) || !Number.isInteger(config.prizeCount) || config.prizeCount < 0 || config.prizeCount > 50) return s;
    const prizeDefinitions = Array.from({ length: config.prizeCount }, (_, i) => s.prizeDefinitions[i] ?? { id: `prize-${i + 1}`, name: '' });
    return { ...s, config, prizeDefinitions };
  }
  if (a.type === 'define-prize') {
    if (s.stage !== 'setup-prizes' || typeof a.name !== 'string' || a.name.length > 100 || !s.prizeDefinitions.some(p => p.id === a.prizeId)) return s;
    return { ...s, prizeDefinitions: s.prizeDefinitions.map(p => p.id === a.prizeId ? { ...p, name: a.name } : p) };
  }
  if (a.type === 'add-participant') {
    if (!['setup-basics', 'setup-prizes', 'live'].includes(s.stage) || !validFixture(a) || s.participants.some(p => p.id === a.id)) return s;
    return { ...s, participants: [...s.participants, { id: a.id, name: a.name.trim(), status: 'neverPlayed' }] };
  }
  if (a.type === 'setup-next') return s.stage === 'setup-basics' && s.config.eventName.trim() ? { ...s, stage: 'setup-prizes' } : s;
  if (a.type === 'setup-back') return s.stage === 'setup-prizes' ? { ...s, stage: 'setup-basics' } : s;
  if (a.type === 'start') {
    if (s.stage !== 'setup-prizes' || !s.config.eventName.trim() || !Number.isFinite(a.now) || a.now < 0
      || (s.startedAt !== null && a.now < s.startedAt) || s.prizeDefinitions.some(p => !p.name.trim())) return s;
    if (a.participants && (!a.participants.every(validFixture) || new Set(a.participants.map(p => p.id)).size !== a.participants.length)) return s;
    return { ...s, stage: 'live', startedAt: s.startedAt ?? a.now,
      participants: a.participants ? a.participants.map(p => ({ ...p, name: p.name.trim(), status: 'neverPlayed' })) : s.participants };
  }
  if (a.type === 'select-participant') {
    if (s.stage !== 'live' || s.activeParticipantId || (capacityReached(s) && !a.confirmNoWinner)) return s;
    let participant: Participant | undefined;
    if (a.mode === 'manual') participant = s.participants.find(p => p.id === a.id && p.status !== 'qualified');
    else {
      if (!Number.isFinite(a.random) || a.random < 0 || a.random >= 1) return s;
      const eligible = s.participants.filter(p => p.status === 'neverPlayed');
      participant = eligible[Math.floor(a.random * eligible.length)];
    }
    return participant ? { ...s, activeParticipantId: participant.id, activeRoundNoWinner: capacityReached(s) } : s;
  }
  if (a.type === 'record-outcome') {
    if (s.stage !== 'live' || !s.activeParticipantId || !['qualified', 'exhausted'].includes(a.outcome)) return s;
    const id = s.activeParticipantId;
    const qualified = a.outcome === 'qualified' && !s.activeRoundNoWinner && !capacityReached(s);
    return { ...s, activeParticipantId: null, activeRoundNoWinner: false,
      participants: s.participants.map(p => p.id === id ? { ...p, status: qualified ? 'qualified' : 'lost' } : p),
      qualificationOrder: qualified ? [...s.qualificationOrder, id] : s.qualificationOrder,
      rounds: [...s.rounds, { participantId: id, outcome: s.activeRoundNoWinner ? 'no-winner' : qualified ? 'qualified' : 'lost' }] };
  }
  if (a.type === 'show-prizes') return s.stage === 'live' && !s.activeParticipantId ? { ...s, stage: 'prizes' } : s;
  if (a.type === 'back-live') return s.stage === 'prizes' && s.awards.length === 0 ? { ...s, stage: 'live' } : s;
  if (a.type === 'open-prize') {
    if (s.stage !== 'prizes' || !a.confirmed || !s.prizeDefinitions.some(p => p.id === a.prizeId) || s.awards.some(x => x.prizeId === a.prizeId)) return s;
    if (a.winnerId !== null && (!s.qualificationOrder.includes(a.winnerId) || s.awards.some(x => x.winnerId === a.winnerId))) return s;
    return { ...s, awards: [...s.awards, { prizeId: a.prizeId, winnerId: a.winnerId }] };
  }
  if (a.type === 'closing') return s.stage === 'prizes' && (unopenedPrizeCount(s) === 0 || a.confirmed) ? { ...s, stage: 'closing' } : s;
  if (a.type === 'back-prizes') return s.stage === 'closing' ? { ...s, stage: 'prizes' } : s;
  if (a.type === 'complete') {
    if (s.stage !== 'closing' || !a.confirmed) return s;
    // Minimal in-memory local results snapshot; this is not a retention guarantee.
    const awards = actualAwards(s);
    return { ...s, stage: 'completed', awards,
      participants: s.participants.filter(p => awards.some(x => x.winnerId === p.id)),
      prizeDefinitions: s.prizeDefinitions.filter(p => awards.some(x => x.prizeId === p.id)),
      qualificationOrder: s.qualificationOrder.filter(id => awards.some(x => x.winnerId === id)),
      rounds: [], activeParticipantId: null, activeRoundNoWinner: false };
  }
  return s;
}
