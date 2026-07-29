export function toSttLang(language) {
  return language?.startsWith('ar') ? 'ar-SA' : 'en-US';
}

/**
 * Decide which language Kohoola should use for the next reply.
 * Handles explicit switch requests ("speak in Arabic") and auto-detects
 * when the child is already speaking Arabic.
 */
export function detectLanguageFromSpeech(text, currentLanguage = 'en') {
  const trimmed = text.trim();
  if (!trimmed) return currentLanguage;

  const lower = trimmed.toLowerCase();

  const wantsEnglish =
    /\b(speak|talk|say|reply|answer|tell me|continue|switch)(?:\s+\w+){0,4}\s+(?:in\s+)?english\b/i.test(lower) ||
    /\bin english\b/i.test(lower) ||
    /(بالإنجليزية|الإنجليزية|انجليزي|إنجليزي)/.test(trimmed);

  const wantsArabic =
    /\b(speak|talk|say|reply|answer|tell me|continue|switch)(?:\s+\w+){0,4}\s+(?:in\s+)?arabic\b/i.test(lower) ||
    /\bin arabic\b/i.test(lower) ||
    /(بالعربية|العربية|بالعربي|عربي)/.test(trimmed) ||
    /(تكلم|تحدث|احك|قول|جاوب|كلمني|حدثني).{0,20}(بالعرب|العرب)/.test(trimmed);

  if (wantsEnglish && !wantsArabic) return 'en';
  if (wantsArabic && !wantsEnglish) return 'ar';

  const arabicChars = (trimmed.match(/[\u0600-\u06FF]/g) || []).length;
  const latinChars = (trimmed.match(/[a-zA-Z]/g) || []).length;
  if (arabicChars >= 3 && arabicChars > latinChars) return 'ar';
  if (latinChars >= 3 && latinChars > arabicChars) return 'en';

  return currentLanguage;
}
