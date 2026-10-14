export const MAX_PRIZES = 50;
export const MAX_PRIZE_LENGTH = 100;
export type PrizeLinesError = {
  code: 'too-many-prizes' | 'prize-too-long';
  /** Original textarea line, 1-based; null for the whole list. */
  line: number | null;
  limit: number;
};
export type PrizeLinesResult =
  | { valid: true; lines: string[]; count: number; errors: [] }
  | { valid: false; lines: string[]; count: number; errors: PrizeLinesError[] };

/** Preserve prize order and repeated names. Never truncate invalid user input. */
export function parsePrizeLines(text: string): PrizeLinesResult {
  const lines: string[] = [];
  const errors: PrizeLinesError[] = [];
  text.replace(/\r\n?/g, '\n').split('\n').forEach((raw, index) => {
    const name = raw.trim();
    if (!name) return;
    lines.push(name);
    if (name.length > MAX_PRIZE_LENGTH) errors.push({ code: 'prize-too-long', line: index + 1, limit: MAX_PRIZE_LENGTH });
  });
  if (lines.length > MAX_PRIZES) errors.push({ code: 'too-many-prizes', line: null, limit: MAX_PRIZES });
  return errors.length ? { valid: false, lines, count: lines.length, errors } : { valid: true, lines, count: lines.length, errors: [] };
}
