/**
 * Local edition: user-language text for the API's license errors.
 *
 * Pages show `error.message` from failed API calls in their own toasts, so
 * api-client swaps in these messages and every page gets them for free.
 * Kept here (not the i18n files) because api-client runs outside React; the
 * text matches local.license.readOnlyError / userLimitError.
 */

const MESSAGES: Record<string, { en: string; ar: string }> = {
  LICENSE_READ_ONLY: {
    en: 'Read-only: there is no valid license. Ask an administrator to enter a license key.',
    ar: 'للقراءة فقط: لا يوجد ترخيص صالح. اطلب من المسؤول إدخال مفتاح الترخيص.',
  },
  LICENSE_USER_LIMIT: {
    en: "Your license doesn't allow more active users. Deactivate a user or upgrade the license.",
    ar: 'لا يسمح ترخيصك بمزيد من المستخدمين النشطين. عطّل مستخدماً أو قم بترقية الترخيص.',
  },
};

export function licenseErrorMessage(code: string): string | null {
  const m = MESSAGES[code];
  if (!m) return null;
  const lang = typeof document !== 'undefined' && document.documentElement.lang === 'ar' ? 'ar' : 'en';
  return m[lang];
}
