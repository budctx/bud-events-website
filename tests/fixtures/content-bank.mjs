// Synthetic office-word fixture, not the commercial inventory. Safe for public CI.
const rules = [
  ['start-b', 'تبدأ الإجابة بحرف ب', 'Start your answer with B', ['براية', 'بطاقة'], ['book', 'binder']],
  ['start-s', 'تبدأ الإجابة بحرف س', 'Start your answer with S', ['سبورة', 'ساعة'], ['stapler', 'scissors']],
  ['contains-m', 'تحتوي الإجابة على حرف م', 'Include the letter M', ['قلم', 'مكتب'], ['marker', 'mouse']],
  ['contains-r', 'تحتوي الإجابة على حرف ر', 'Include the letter R', ['كرسي', 'ورق'], ['ruler', 'printer']],
  ['contains-n', 'تحتوي الإجابة على حرف ن', 'Include the letter N', ['صندوق', 'منظم'], ['pen', 'printer']],
  ['one-word', 'أجب بكلمة واحدة', 'Answer with one word', ['قلم', 'مكتب'], ['pen', 'desk']],
  ['two-words', 'أجب بكلمتين', 'Answer with two words', ['قلم رصاص', 'لوحة مفاتيح'], ['paper clip', 'desk lamp']],
  ['min-four-letters', 'الإجابة من أربعة أحرف على الأقل', 'Use at least four letters', ['مكتب', 'كرسي'], ['desk', 'book']],
];
export const bank = { version: 'synthetic-office-fixture', status: 'candidate',
  questions: [{ id: 'office-fixture', ar: 'شيء في المكتب', en: 'An office item' }],
  conditions: rules.map(([id, ar, en]) => ({ id, ar, en })) };
export const editorial = { version: bank.version, status: 'candidate',
  answers: rules.map(([conditionId, , , ar, en]) => ({ questionId: 'office-fixture', conditionId, ar, en })) };
