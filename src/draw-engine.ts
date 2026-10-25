/** BU'D Question & Condition shared draw algorithm.
 * Pure state: callers MUST save the returned snapshot atomically with the event.
 * Never expose the private answer/example bank to participants.
 * 23 x 15 is a content approval, NOT permission to publish content in the app.
 */
export type PairId = readonly [questionId: string, conditionId: string];
export type PairCatalog = ReadonlyArray<PairId>;
export type DrawRecord = {
  pair: PairId;
  cycle: number;
  index: number;
};
export type DrawState = {
  cycle: number;
  history: DrawRecord[];
  /** A host must explicitly consent before a new cycle. */
  awaitingNewCycle: boolean;
};
export type DrawResult =
  | { kind: 'drawn'; record: DrawRecord; state: DrawState }
  | { kind: 'exhausted'; state: DrawState };

export const initialDrawState = (): DrawState => ({ cycle: 1, history: [], awaitingNewCycle: false });

const pairKey = ([q, c]: PairId) => JSON.stringify([q, c]);
const validId = (id: unknown): id is string => typeof id === 'string' && id.length > 0 && id.length <= 128;

/** The catalog must be curated in each language; don't assume its Cartesian product is valid. */
export function validateCatalog(catalog: PairCatalog): void {
  if (!catalog.length || catalog.length > 20000) throw new Error('EMPTY_OR_OVERSIZED_CATALOG');
  const seen = new Set<string>();
  for (const pair of catalog) {
    if (!Array.isArray(pair) || pair.length !== 2 || !validId(pair[0]) || !validId(pair[1])) throw new Error('INVALID_PAIR');
    const id = pairKey(pair);
    if (seen.has(id)) throw new Error('DUPLICATE_PAIR');
    seen.add(id);
  }
}

function randomIndex(size: number, random: () => number): number {
  const value = random();
  if (!Number.isFinite(value) || value < 0 || value >= 1) throw new Error('INVALID_RANDOM');
  return Math.floor(value * size);
}

/** Immutable, deterministic with injected random function for tests.
 * Prefer a question not drawn in the immediately previous round; also favor
 * the least-used question/condition in the current cycle before random tie-breaking.
 */
export function drawNext(
  catalog: PairCatalog, snapshot: DrawState, random: () => number = Math.random,
): DrawResult {
  validateCatalog(catalog);
  if (!Number.isSafeInteger(snapshot.cycle) || snapshot.cycle < 1 || !Array.isArray(snapshot.history)) throw new Error('INVALID_DRAW_STATE');
  if (snapshot.awaitingNewCycle) return { kind: 'exhausted', state: snapshot };
  const history = snapshot.history;
  const current = history.filter(record => record.cycle === snapshot.cycle);
  const catalogKeys = new Set(catalog.map(pairKey));
  if (history.some(record => !Number.isSafeInteger(record.index) || record.index < 0
    || !Number.isSafeInteger(record.cycle) || record.cycle < 1 || !catalogKeys.has(pairKey(record.pair)))) {
    throw new Error('INVALID_DRAW_HISTORY');
  }
  const used = new Set(current.map(record => pairKey(record.pair)));
  if (used.size !== current.length) throw new Error('REPEATED_PAIR_IN_CYCLE');
  const available = catalog.filter(pair => !used.has(pairKey(pair)));
  if (!available.length) {
    return { kind: 'exhausted', state: { ...snapshot, awaitingNewCycle: true } };
  }
  const previousQuestion = history.at(-1)?.pair[0];
  const avoidImmediateRepeat = available.some(pair => pair[0] !== previousQuestion);
  const choices = avoidImmediateRepeat ? available.filter(pair => pair[0] !== previousQuestion) : available;
  const questions = new Map<string, number>(), conditions = new Map<string, number>();
  for (const record of current) {
    questions.set(record.pair[0], (questions.get(record.pair[0]) ?? 0) + 1);
    conditions.set(record.pair[1], (conditions.get(record.pair[1]) ?? 0) + 1);
  }
  const score = (pair: PairId) => (questions.get(pair[0]) ?? 0) * 2 + (conditions.get(pair[1]) ?? 0);
  const min = Math.min(...choices.map(score));
  const balanced = choices.filter(pair => score(pair) === min);
  const selected = balanced[randomIndex(balanced.length, random)];
  const record: DrawRecord = { pair: [selected[0], selected[1]], cycle: snapshot.cycle, index: history.length + 1 };
  return { kind: 'drawn', record, state: { ...snapshot, history: [...history, record], awaitingNewCycle: false } };
}

/** Only call on an explicit host action after exhaustion. */
export function approveNewCycle(snapshot: DrawState): DrawState {
  if (!snapshot.awaitingNewCycle) throw new Error('CYCLE_NOT_EXHAUSTED');
  return { cycle: snapshot.cycle + 1, history: snapshot.history.slice(), awaitingNewCycle: false };
}
