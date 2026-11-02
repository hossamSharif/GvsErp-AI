/**
 * Invoice number/date formatting
 *
 * Printed invoices always use Latin digits (0-9) and the Gregorian calendar,
 * also in Arabic: plain `ar-SA` renders Arabic-Indic digits and Hijri dates.
 */

const amountFormat = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const qtyFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 });

/** 1234.5 → "1,234.50" */
export function formatAmount(value: number): string {
  return amountFormat.format(value);
}

/** 1234.5 → "1,234.5"; whole quantities print without decimals */
export function formatQty(value: number): string {
  return qtyFormat.format(value);
}

/** Intl locale for dates: localised month names, Latin digits, Gregorian calendar. */
export function dateLocale(locale: string): string {
  return locale === 'ar' ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-US';
}

/** Long date, e.g. "18 October 2026" / "18 أكتوبر 2026" */
export function formatLongDate(dateString: string, locale: string): string {
  return new Date(dateString).toLocaleDateString(dateLocale(locale), {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/** Numeric date, e.g. "18/10/2026" */
export function formatShortDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-GB', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

/** Time of day, e.g. "12:06 PM" */
export function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}
