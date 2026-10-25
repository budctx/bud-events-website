import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const ids = ['start-b', 'start-s', 'contains-m', 'contains-r', 'contains-n', 'one-word', 'two-words', 'min-four-letters'];
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const normalized = (text, locale) => locale === 'ar'
  ? text.normalize('NFC').replace(/[\u064B-\u065F\u0670\u0640]/gu, '').replace(/[أإآٱ]/gu, 'ا').replace(/ى/gu, 'ي').trim()
  : text.normalize('NFC').toLowerCase().trim();
function satisfies(text, locale, condition) {
  const value = normalized(text, locale);
  const letters = value.match(/\p{L}/gu) ?? [];
  const words = value.split(/\s+/u);
  const targets = locale === 'ar' ? { 'start-b': 'ب', 'start-s': 'س', 'contains-m': 'م', 'contains-r': 'ر', 'contains-n': 'ن' }
    : { 'start-b': 'b', 'start-s': 's', 'contains-m': 'm', 'contains-r': 'r', 'contains-n': 'n' };
  if (condition.startsWith('start-')) return value.startsWith(targets[condition]);
  if (condition.startsWith('contains-')) return value.includes(targets[condition]);
  if (condition === 'one-word') return words.length === 1;
  if (condition === 'two-words') return words.length === 2;
  return condition === 'min-four-letters' && letters.length >= 4;
}
/** Mechanical coverage/spelling evidence only. Topic relevance and commercial acceptance require separate review. */
export function validateContent(bank, editorial) {
  const fail = message => { throw new Error(message); };
  if (!object(bank) || !object(editorial) || bank.status !== 'candidate' || editorial.status !== 'candidate'
    || !/^[a-z][a-z0-9-]{4,79}$/.test(bank.version ?? '') || bank.version !== editorial.version) fail('Invalid candidate version/status');
  for (const [name, limit] of [['questions', 65], ['conditions', 40]]) {
    const cards = bank[name];
    if (!Array.isArray(cards) || cards.length < 1 || cards.length > 500) fail('Invalid ' + name + ' count');
    const seenIds = new Set(), texts = { ar: new Set(), en: new Set() };
    for (const card of cards) {
      if (!object(card) || !/^[a-z][a-z0-9-]{1,60}$/.test(card.id ?? '') || seenIds.has(card.id)) fail('Invalid/duplicate card ID');
      seenIds.add(card.id);
      for (const locale of ['ar', 'en']) {
        const label = card[locale];
        if (typeof label !== 'string' || !label.trim() || label !== label.trim() || [...label].length > limit
          || /[\r\n<>]/u.test(label) || texts[locale].has(normalized(label, locale))) fail('Invalid/duplicate ' + locale + ' card: ' + card.id);
        texts[locale].add(normalized(label, locale));
      }
    }
  }
  if (bank.conditions.length !== ids.length || !ids.every(id => bank.conditions.some(card => card.id === id))) fail('Unexpected condition rules');
  if (!Array.isArray(editorial.answers)) fail('Missing answer evidence');
  const questions = new Set(bank.questions.map(card => card.id)), seen = new Set();
  for (const pair of editorial.answers) {
    if (!object(pair) || !questions.has(pair.questionId) || !ids.includes(pair.conditionId)) fail('Unknown pair');
    const key = pair.questionId + '/' + pair.conditionId;
    if (seen.has(key)) fail('Duplicate pair: ' + key);
    seen.add(key);
    for (const locale of ['ar', 'en']) {
      const answers = pair[locale];
      if (!Array.isArray(answers) || answers.length < 2) fail('Insufficient ' + locale + ' examples: ' + key);
      const distinct = new Set();
      for (const answer of answers) {
        if (typeof answer !== 'string' || answer !== answer.trim() || !answer
          || !/^[\p{L}\p{M} ]+$/u.test(answer) || [...answer].length > 80) fail('Invalid example spelling: ' + key);
        // Keep bilingual evidence in its intended script; no Romanized Arabic evidence.
        const script = locale === 'ar' ? /^[\p{Script=Arabic}\p{M} ]+$/u : /^[\p{Script=Latin}\p{M} ]+$/u;
        const clean = normalized(answer, locale);
        if (!script.test(answer) || !clean || clean.split(/\s+/u).some(word => !/\p{L}/u.test(word))
          || !satisfies(answer, locale, pair.conditionId)) fail('Condition mismatch: ' + key + '/' + locale);
        if (distinct.has(clean)) fail('Duplicate example: ' + key + '/' + locale);
        distinct.add(clean);
      }
    }
  }
  const pairs = bank.questions.length * bank.conditions.length;
  if (seen.size !== pairs) fail('Incomplete Cartesian coverage: ' + seen.size + '/' + pairs);
  return { version: bank.version, status: 'candidate', questionCount: bank.questions.length, conditionCount: bank.conditions.length,
    pairsPerLocale: pairs, localePairsChecked: pairs * 2, exampleCount: editorial.answers.reduce((sum, pair) => sum + pair.ar.length + pair.en.length, 0),
    semanticReviewPassed: false, ownerApproved: false, published: false };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const bankBytes = await readFile(new URL('../content/question-condition/bank.json', import.meta.url));
    const examples = await readFile(new URL('../content/question-condition/editorial-answers.json', import.meta.url));
    const result = validateContent(JSON.parse(bankBytes), JSON.parse(examples));
    console.log(JSON.stringify({ ...result, bankSha256: createHash('sha256').update(bankBytes).digest('hex'),
      editorialSha256: createHash('sha256').update(examples).digest('hex') }, null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
