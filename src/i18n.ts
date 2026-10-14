export type Locale = 'ar' | 'en';
export const copy = {
  ar: {
    title: 'سؤال وشرط', phases: ['إعداد', 'فعالية', 'جوائز', 'ختام'],
    longPhases: ['إعداد الفعالية', 'شاشة الفعالية', 'الجوائز', 'الختام'],
    participant: 'المشارك الحالي', question: 'سؤال', condition: 'شرط',
    hidden: 'مخفي', revealed: 'مكشوفة', reveal: 'اكشف',
    hint: 'اكشف كل بطاقة مستقلة؛ المؤقت ينتظر البطاقتين',
    waiting: 'ينتظر كشف البطاقتين', running: 'العد التنازلي', zero: 'انتهى الوقت · بانتظار قرار الهوست',
    judgment: 'قرار الهوست', correct: 'صحيح', incorrect: 'غير صحيح',
    session: 'المدة الأصلية · لا تُوقف مؤقت الجلسة', demo: 'نموذج تصميم · بيانات توضيحية',
    qualified: 'تأهّل المشارك · لم تُمنح جائزة', exhausted: 'انتهت المحاولات · لم يتأهل المشارك',
    controls: 'إعدادات المعاينة', reset: 'إعادة ضبط المعاينة', theme: 'المظهر', light: 'فاتح', dark: 'داكن',
    language: 'اللغة', duration: 'مدة التحدي', attempts: 'المحاولات', attempt: 'المحاولة',
    note: 'هذه معاينة محلية للمكونات. لا تُنشئ فعالية فعلية أو تربط حساب دسكورد.',
    seconds: 'ثوانٍ', skip: 'انتقل إلى شاشة الفعالية', stopped: 'التحدي مكتمل',
  },
  en: {
    title: 'Question & Condition', phases: ['Setup', 'Live', 'Prizes', 'End'],
    longPhases: ['Event Setup', 'Event Screen', 'Prizes', 'Closing'],
    participant: 'Current participant', question: 'Question', condition: 'Condition',
    hidden: 'Hidden', revealed: 'Revealed', reveal: 'Reveal',
    hint: 'Reveal independently; timer awaits both cards',
    waiting: 'Await both cards', running: 'Countdown', zero: 'Time ended · awaiting host judgment',
    judgment: 'Host judgment', correct: 'Correct', incorrect: 'Incorrect',
    session: 'Original duration · no clock pause', demo: 'DESIGN SPECIMEN · EXAMPLE DATA',
    qualified: 'Participant qualified · no prize awarded', exhausted: 'Attempts exhausted · not qualified',
    controls: 'Preview settings', reset: 'Reset preview', theme: 'Appearance', light: 'Light', dark: 'Dark',
    language: 'Language', duration: 'Challenge duration', attempts: 'Attempts', attempt: 'Attempt',
    note: 'A local component preview. It does not create a real event or connect a Discord account.',
    seconds: 'seconds', skip: 'Skip to event screen', stopped: 'Challenge complete',
  },
} as const;
export const samplePairs = {
  ar: [
    ['اذكر ثلاثة أشياء تأخذها في رحلة.', 'ابدأ إجابتك بكلمة «معي».'],
    ['اذكر ثلاثة أشياء لونها أصفر.', 'أجب دون تكرار أي كلمة.'],
    ['اذكر ثلاثة أماكن تزورها في عطلة.', 'اختم إجابتك بكلمة «تم».'],
  ],
  en: [
    ['Name three things you take on a trip.', 'Start your answer with “I bring”.'],
    ['Name three things that are yellow.', 'Do not repeat any word.'],
    ['Name three places to visit on a holiday.', 'Finish your answer with “done”.'],
  ],
} as const;
