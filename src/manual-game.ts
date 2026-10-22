// In-memory rehearsal only. No participant identities, attendance or commerce authority.
import { parsePrizeLines } from './prize-lines.ts';
export type ManualConfig = { duration: number; timerEnabled: boolean; attempts: 1 | 2 | 3 };
export type ManualWinner = { id: string; name: string };
export type ManualPrize = { id: string; name: string; revealed: boolean; winnerId: string | null };
export type ManualState = {
  phase: 'setup' | 'live' | 'prizes' | 'closing'; config: ManualConfig;
  prizes: ManualPrize[]; winners: ManualWinner[]; nextWinnerNumber: number;
  question: boolean; condition: boolean; attempt: number; round: number;
  deadline: number | null; remaining: number; pendingWinner: boolean;
};
export type ManualAction =
  | { type: 'start'; config: ManualConfig; prizeText: string }
  | { type: 'reveal'; card: 'question' | 'condition'; now: number }
  | { type: 'tick'; now: number }
  | { type: 'correct' | 'wrong' | 'cancel-winner' }
  | { type: 'save-winner'; name: string }
  | { type: 'rename-winner'; winnerId: string; name: string }
  | { type: 'delete-winner'; winnerId: string }
  | { type: 'phase'; phase: 'live' | 'prizes' | 'closing' }
  | { type: 'award'; prizeId: string; winnerId: string }
  | { type: 'reset' };
export function initialManualState(): ManualState {
  return { phase: 'setup', config: { duration: 5, timerEnabled: false, attempts: 1 }, prizes: [], winners: [], nextWinnerNumber: 1,
    question: false, condition: false, attempt: 1, round: 0, deadline: null, remaining: 5, pendingWinner: false };
}
export const validDuration = (value: number) => Number.isSafeInteger(value) && value >= 3 && value <= 30;
export function winnerNameError(_state: ManualState, value: string): 'empty' | 'long' | null {
  const name = value.trim();
  if (!name) return 'empty';
  if (name.length > 80) return 'long';
  return null;
}
function nextRound(state: ManualState, attempt = 1): ManualState {
  return { ...state, question: false, condition: false, deadline: null, remaining: state.config.duration,
    pendingWinner: false, attempt, round: state.round + 1 };
}
export function manualGameReducer(state: ManualState, action: ManualAction): ManualState {
  if (action.type === 'reset') return state.phase === 'closing' ? initialManualState() : state;
  if (action.type === 'start') {
    const parsed = parsePrizeLines(action.prizeText);
    if (state.phase !== 'setup' || !validDuration(action.config.duration) || ![1, 2, 3].includes(action.config.attempts)
      || typeof action.config.timerEnabled !== 'boolean' || !parsed.valid) return state;
    return { ...initialManualState(), phase: 'live', config: { ...action.config }, remaining: action.config.duration,
      prizes: parsed.lines.map((name, index) => ({ id: `prize-${index + 1}`, name, revealed: false, winnerId: null })) };
  }
  if (action.type === 'phase') {
    if (state.pendingWinner || state.phase === 'setup' || state.phase === 'closing') return state;
    if (action.phase === 'live' && state.phase === 'prizes' && !state.prizes.some(p => p.revealed)) return { ...state, phase: 'live' };
    if (action.phase === 'prizes' && state.phase === 'live') return { ...state, phase: 'prizes' };
    if (action.phase === 'closing' && state.phase === 'prizes') return { ...state, phase: 'closing', deadline: null };
    return state;
  }
  if (action.type === 'rename-winner' || action.type === 'delete-winner') {
    if (!['live', 'prizes'].includes(state.phase) || state.pendingWinner || !state.winners.some(w => w.id === action.winnerId)) return state;
    if (action.type === 'rename-winner') {
      if (winnerNameError(state, action.name)) return state;
      return { ...state, winners: state.winners.map(w => w.id === action.winnerId ? { ...w, name: action.name.trim() } : w) };
    }
    return { ...state, winners: state.winners.filter(w => w.id !== action.winnerId),
      prizes: state.prizes.map(p => p.winnerId === action.winnerId ? { ...p, revealed: false, winnerId: null } : p) };
  }
  if (action.type === 'award') {
    if (state.phase !== 'prizes' || !state.winners.some(w => w.id === action.winnerId)
      || state.prizes.some(p => p.winnerId === action.winnerId)) return state;
    const prize = state.prizes.find(p => p.id === action.prizeId);
    if (!prize || prize.revealed) return state;
    return { ...state, prizes: state.prizes.map(p => p.id === action.prizeId ? { ...p, revealed: true, winnerId: action.winnerId } : p) };
  }
  if (state.phase !== 'live') return state;
  if (action.type === 'cancel-winner') return state.pendingWinner ? { ...state, pendingWinner: false } : state;
  if (action.type === 'save-winner') {
    if (!state.pendingWinner || winnerNameError(state, action.name) || (state.prizes.length > 0 && state.winners.length >= state.prizes.length)) return state;
    return nextRound({ ...state, nextWinnerNumber: state.nextWinnerNumber + 1, winners: [...state.winners, { id: `winner-${state.nextWinnerNumber}`, name: action.name.trim() }] });
  }
  if (state.pendingWinner) return state;
  if (action.type === 'reveal') {
    if (!Number.isFinite(action.now) || state[action.card]) return state;
    const next = { ...state, [action.card]: true };
    if (next.question && next.condition && state.config.timerEnabled && next.deadline === null) next.deadline = action.now + state.config.duration * 1000;
    return next;
  }
  if (action.type === 'tick') {
    if (!Number.isFinite(action.now) || state.deadline === null) return state;
    return { ...state, remaining: Math.max(0, Math.ceil((state.deadline - action.now) / 1000)) };
  }
  if (!state.question || !state.condition) return state;
  if (action.type === 'correct') {
    if (state.prizes.length > 0 && state.winners.length >= state.prizes.length) return state;
    return { ...state, pendingWinner: true };
  }
  if (action.type === 'wrong') return nextRound(state, state.attempt < state.config.attempts ? state.attempt + 1 : 1);
  return state;
}
