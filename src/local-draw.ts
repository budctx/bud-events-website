// Browser-only practice draw bag. Production draws must be authoritative server transactions.
export type PairIndex = readonly [question: number, condition: number];
export type DrawBag = { remaining: PairIndex[]; cycle: number };
export const initialDrawBag = (): DrawBag => ({ remaining: [], cycle: 0 });
export function nextPair(
  bag: DrawBag,
  questionCount: number,
  conditionCount: number,
  random: () => number = Math.random,
): { pair: PairIndex; bag: DrawBag } {
  if (!Number.isSafeInteger(questionCount) || !Number.isSafeInteger(conditionCount)
    || questionCount < 1 || conditionCount < 1) throw new Error('No playable published question/condition pair');
  let remaining = bag.remaining.slice();
  let cycle = bag.cycle;
  if (remaining.length === 0) {
    remaining = Array.from({ length: questionCount }, (_, q) =>
      Array.from({ length: conditionCount }, (_, c): PairIndex => [q, c])).flat();
    for (let i = remaining.length - 1; i > 0; i--) {
      const n = random();
      if (!Number.isFinite(n) || n < 0 || n >= 1) throw new Error('Invalid random draw');
      const j = Math.floor(n * (i + 1));
      [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
    }
    cycle++;
  }
  const pair = remaining.shift();
  if (!pair) throw new Error('Empty pair bank');
  return { pair, bag: { remaining, cycle } };
}
