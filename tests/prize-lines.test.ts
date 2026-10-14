import assert from 'node:assert/strict';
import test from 'node:test';
import { parsePrizeLines } from '../src/prize-lines.ts';

test('prize lines normalize pasted newlines, ignore whitespace-only lines and preserve order/duplicates', () => {
  assert.deepEqual(parsePrizeLines('  بطاقة هدية  \r\n \t\r\nGame key\rبطاقة هدية\n'), {
    valid: true, lines: ['بطاقة هدية', 'Game key', 'بطاقة هدية'], count: 3, errors: [],
  });
});
test('zero and 50 prizes are valid, including exact 100-character names', () => {
  assert.deepEqual(parsePrizeLines(' \r\n\t\n'), { valid: true, lines: [], count: 0, errors: [] });
  const text = Array.from({ length: 50 }, () => 'x'.repeat(100)).join('\n');
  assert.equal(parsePrizeLines(text).valid, true);
  assert.equal(parsePrizeLines(text).count, 50);
});
test('over-limit lists report error without dropping any prizes', () => {
  const result = parsePrizeLines(Array.from({ length: 51 }, (_, i) => `Prize ${i + 1}`).join('\n'));
  assert.equal(result.valid, false);
  assert.equal(result.count, 51);
  assert.equal(result.lines.at(-1), 'Prize 51');
  assert.deepEqual(result.errors, [{ code: 'too-many-prizes', line: null, limit: 50 }]);
});
test('long names identify original physical line and keep all text for correction', () => {
  const long = 'x'.repeat(101);
  const result = parsePrizeLines(`\nGood\r\n  ${long}  \n`);
  assert.equal(result.valid, false);
  assert.deepEqual(result.lines, ['Good', long]);
  assert.deepEqual(result.errors, [{ code: 'prize-too-long', line: 3, limit: 100 }]);
});
