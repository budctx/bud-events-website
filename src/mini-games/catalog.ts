/** Curated Arabic-only challenge material; no network requests, external dictionaries or API keys. */
export const GAME_LABELS = {
  bomb: 'القنبلة',
  'form-word': 'تكوين كلمة',
  scramble: 'الكلمة المبعثرة',
  pattern: 'احفظ النمط',
  emoji: 'ذاكرة الإيموجي',
  wheel: 'عجلة الحروف',
} as const;
export type MiniGameKind = keyof typeof GAME_LABELS;
export const GAME_IDS = Object.keys(GAME_LABELS) as MiniGameKind[];

export const WORDS = [
  'مدرسة', 'مكتبة', 'منارة', 'حديقة', 'قصيدة', 'سفينة', 'نافذة', 'مصباح',
  'مفتاح', 'طاولة', 'تجربة', 'معرفة', 'جزيرة', 'مساحة', 'حقيبة', 'شجرة',
  'مدينة', 'كواكب', 'صداقة', 'رسالة', 'نجارة', 'رياح', 'منزل', 'فراشة',
  'تاريخ', 'مزرعة', 'قمرية', 'وردة', 'دراجة', 'جريدة',
] as const;
export const EMOJI_SYMBOLS = ['🐱','🚀','🍉','🐼','⭐','🍋','🐙','🎧','🦋','🌻','🎲','🐝','🍎','🪐','⚽'] as const;
export const PATTERN_COLORS = ['أحمر','أزرق','أخضر','أصفر'] as const;
export type PatternColor = typeof PATTERN_COLORS[number];

export const CATEGORIES = ['اسم','حيوان','نبات','جماد','بلاد'] as const;
export type WheelCategory = typeof CATEGORIES[number];
/** The four rejected letters are deliberately absent. Every approved category-letter combination has a concrete example. */
export const LETTERS = [...'ابتجحخدرزسشصطعغفقكلمنهوي'] as const;
export const WHEEL_EXAMPLES: Record<WheelCategory, Record<string,string>> = {
  اسم: {ا:'أحمد',ب:'بدر',ت:'تركي',ج:'جاسم',ح:'حمد',خ:'خالد',د:'دلال',ر:'ريم',ز:'زيد',س:'سالم',ش:'شيماء',ص:'صالح',ط:'طارق',ع:'علي',غ:'غادة',ف:'فهد',ق:'قاسم',ك:'كريم',ل:'ليلى',م:'محمد',ن:'ناصر',ه:'هند',و:'وليد',ي:'ياسر'},
  حيوان: {ا:'أسد',ب:'بقرة',ت:'تمساح',ج:'جمل',ح:'حصان',خ:'خروف',د:'دب',ر:'راكون',ز:'زرافة',س:'سمكة',ش:'شمبانزي',ص:'صقر',ط:'طاووس',ع:'عقرب',غ:'غزال',ف:'فأر',ق:'قرد',ك:'كلب',ل:'لاما',م:'ماعز',ن:'نمر',ه:'هدهد',و:'وطواط',ي:'يرقة'},
  نبات: {ا:'أرز',ب:'بصل',ت:'تفاح',ج:'جزر',ح:'حناء',خ:'خيار',د:'دوار الشمس',ر:'رمان',ز:'زيتون',س:'سمسم',ش:'شبت',ص:'صبار',ط:'طماطم',ع:'عنب',غ:'غار',ف:'فلفل',ق:'قمح',ك:'كركديه',ل:'ليمون',م:'موز',ن:'نعناع',ه:'هيل',و:'ورد',ي:'ياسمين'},
  جماد: {ا:'إبريق',ب:'باب',ت:'تلفاز',ج:'جرس',ح:'حقيبة',خ:'خزانة',د:'دفتر',ر:'راديو',ز:'زجاج',س:'سرير',ش:'شباك',ص:'صحن',ط:'طاولة',ع:'علبة',غ:'غطاء',ف:'فرشاة',ق:'قلم',ك:'كتاب',ل:'لوحة',م:'مفتاح',ن:'نافذة',ه:'هاتف',و:'وسادة',ي:'يخت'},
  بلاد: {ا:'أبها',ب:'بيروت',ت:'تونس',ج:'جدة',ح:'حائل',خ:'خميس مشيط',د:'دبي',ر:'الرياض',ز:'زنجبار',س:'سوريا',ش:'شرم الشيخ',ص:'صنعاء',ط:'طوكيو',ع:'عمان',غ:'غزة',ف:'فرنسا',ق:'قطر',ك:'كندا',ل:'لندن',م:'مصر',ن:'نجران',ه:'هولندا',و:'وهران',ي:'ينبع'},
};
export function availableWheelPairs(): {category:WheelCategory;letter:string;example:string}[] {
  return CATEGORIES.flatMap(category => LETTERS.flatMap(letter => {
    const example=WHEEL_EXAMPLES[category][letter];
    return example?[{category,letter,example}]:[];
  }));
}
