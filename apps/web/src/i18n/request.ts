import { getRequestConfig } from 'next-intl/server';
import { locales, defaultLocale, type Locale } from './config';

export { locales, defaultLocale, type Locale };

export default getRequestConfig(async ({ locale }) => ({
  messages: (await import(`../locales/${locale}/common.json`)).default,
}));
