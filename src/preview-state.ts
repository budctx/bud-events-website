// Local preview only. The future server must own authoritative event state.
export type Duration = 5 | 7 | 10;
export type Attempts = 1 | 2 | 3;
export type PreviewState = {
  question: boolean; condition: boolean; duration: Duration; maxAttempts: Attempts; timerEnabled: boolean;
  attempt: number; deadline: number | null; seconds: number;
  outcome: 'qualified' | 'exhausted' | null;
};
export type Action =
  | { type: 'reveal'; card: 'question' | 'condition'; now: number }
  | { type: 'tick'; now: number }
  | { type: 'judge'; correct: boolean }
  | { type: 'reset'; duration: Duration; maxAttempts: Attempts; timerEnabled?: boolean };
export function initialState(duration: Duration = 5, maxAttempts: Attempts = 1, timerEnabled = true): PreviewState {
  return { question: false, condition: false, duration, maxAttempts, timerEnabled, attempt: 1,
    deadline: null, seconds: duration, outcome: null };
}
export function previewReducer(state: PreviewState, action: Action): PreviewState {
  if (action.type === 'reset') return initialState(action.duration, action.maxAttempts, action.timerEnabled ?? true);
  if (state.outcome) return state;
  if (action.type === 'reveal') {
    if (state[action.card]) return state;
    const next = { ...state, [action.card]: true };
    if (state.timerEnabled && next.question && next.condition && next.deadline === null) next.deadline = action.now + state.duration * 1000;
    return next;
  }
  if (action.type === 'tick') {
    if (!state.timerEnabled || state.deadline === null) return state;
    const seconds = Math.max(0, Math.ceil((state.deadline - action.now) / 1000));
    return seconds === state.seconds ? state : { ...state, seconds };
  }
  if (!(state.question && state.condition)) return state;
  if (action.correct) return { ...state, outcome: 'qualified', deadline: null };
  if (state.attempt < state.maxAttempts) return { ...initialState(state.duration, state.maxAttempts, state.timerEnabled), attempt: state.attempt + 1 };
  return { ...state, outcome: 'exhausted', deadline: null };
}
