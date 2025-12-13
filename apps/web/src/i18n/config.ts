/**
 * i18n Configuration
 *
 * Configuration for next-intl internationalization.
 */

export const locales = ['en', 'ar'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'en';

export const localeNames: Record<Locale, string> = {
  en: 'English',
  ar: 'العربية',
};

export const localeDirections: Record<Locale, 'ltr' | 'rtl'> = {
  en: 'ltr',
  ar: 'rtl',
};

export function isRtlLocale(locale: Locale): boolean {
  return localeDirections[locale] === 'rtl';
}
