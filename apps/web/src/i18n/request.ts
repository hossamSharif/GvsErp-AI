import { getRequestConfig } from 'next-intl/server';

export const locales = ['en', 'ar'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'en';

export default getRequestConfig(async ({ requestLocale }) => {
  // Get the requested locale
  let locale = await requestLocale;

  // Validate the locale is supported
  if (!locale || !locales.includes(locale as Locale)) {
    locale = defaultLocale;
  }

  // Load all translation files and merge them
  const [
    common,
    items,
    invoices,
    warehouses,
    parties,
    expenses,
    hr,
    accounting,
    settings,
    pos,
    reports,
    dashboard,
    purchases,
    sales,
  ] = await Promise.all([
    import(`../locales/${locale}/common.json`),
    import(`../locales/${locale}/items.json`),
    import(`../locales/${locale}/invoices.json`),
    import(`../locales/${locale}/warehouses.json`),
    import(`../locales/${locale}/parties.json`),
    import(`../locales/${locale}/expenses.json`),
    import(`../locales/${locale}/hr.json`),
    import(`../locales/${locale}/accounting.json`),
    import(`../locales/${locale}/settings.json`),
    import(`../locales/${locale}/pos.json`),
    import(`../locales/${locale}/reports.json`),
    import(`../locales/${locale}/dashboard.json`),
    import(`../locales/${locale}/purchases.json`),
    import(`../locales/${locale}/sales.json`),
  ]);

  return {
    locale,
    messages: {
      ...common.default,
      ...items.default,
      ...invoices.default,
      ...warehouses.default,
      ...parties.default,
      ...expenses.default,
      ...hr.default,
      ...accounting.default,
      ...settings.default,
      ...pos.default,
      ...reports.default,
      ...dashboard.default,
      ...purchases.default,
      ...sales.default,
    },
  };
});
