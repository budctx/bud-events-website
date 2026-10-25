import test from 'node:test';
import assert from 'node:assert/strict';
import { validateContent } from '../scripts/validate-question-condition-content.mjs';
import { bank, editorial } from './fixtures/content-bank.mjs';

test('synthetic content fixture has exhaustive bilingual lexical evidence without implying semantic or owner acceptance', () => {
  const result = validateContent(bank, editorial);
  assert.equal(result.questionCount, 1); assert.equal(result.conditionCount, 8);
  assert.equal(result.pairsPerLocale, 8); assert.equal(result.localePairsChecked, 16); assert.equal(result.exampleCount, 32);
  assert.equal(result.semanticReviewPassed, false); assert.equal(result.ownerApproved, false); assert.equal(result.published, false);
});
test('coverage verification detects omitted pairs, duplicate pairs and unknown card references', () => {
  const missing = structuredClone(editorial); missing.answers.pop();
  assert.throws(() => validateContent(bank, missing), /Incomplete Cartesian coverage/);
  const duplicate = structuredClone(editorial); duplicate.answers.push(duplicate.answers[0]);
  assert.throws(() => validateContent(bank, duplicate), /Duplicate pair/);
  const wrong = structuredClone(editorial); wrong.answers[0].questionId = 'not-a-card';
  assert.throws(() => validateContent(bank, wrong), /Unknown pair/);
});
test('answer verification rejects wrong letters, duplicate answers and untranslated locale evidence', () => {
  const wrong = structuredClone(editorial);
  wrong.answers.find(pair => pair.conditionId === 'start-b').en[0] = 'Apple';
  assert.throws(() => validateContent(bank, wrong), /Condition mismatch/);
  const duplicate = structuredClone(editorial); duplicate.answers[0].ar[1] = duplicate.answers[0].ar[0];
  assert.throws(() => validateContent(bank, duplicate), /Duplicate example/);
  const missingLocale = structuredClone(editorial); missingLocale.answers[0].en = [];
  assert.throws(() => validateContent(bank, missingLocale), /Insufficient en examples/);
  const wrongScript = structuredClone(editorial); wrongScript.answers[0].en[0] = 'بصل';
  assert.throws(() => validateContent(bank, wrongScript), /Condition mismatch/);
});
test('card integrity rejects duplicate translations and missing locale labels', () => {
  const duplicate = structuredClone(bank); duplicate.questions.push({ ...duplicate.questions[0], id: 'another-fixture' });
  assert.throws(() => validateContent(duplicate, editorial), /duplicate ar card/);
  const missing = structuredClone(bank); delete missing.questions[0].en;
  assert.throws(() => validateContent(missing, editorial), /Invalid\/duplicate en card/);
});
test('standalone combining marks cannot count as a word in either locale', () => {
  for (const locale of ['ar', 'en']) for (const condition of ['one-word', 'two-words']) {
    const changed = structuredClone(editorial);
    const pair = changed.answers.find(pair => pair.conditionId === condition);
    pair[locale][0] = condition === 'one-word' ? '\u0301' : (locale === 'ar' ? 'قلم \u0301' : 'pen \u0301');
    assert.throws(() => validateContent(bank, changed), /Condition mismatch/);
  }
});
