/**
 * RTL Utilities for ERP System
 *
 * Helper functions and utilities for Right-to-Left (RTL) language support.
 * Primarily for Arabic language but extensible for other RTL languages.
 */

/**
 * Get the current text direction based on locale
 */
export function getTextDirection(locale: string): 'ltr' | 'rtl' {
  const rtlLocales = ['ar', 'he', 'fa', 'ur'];
  return rtlLocales.includes(locale) ? 'rtl' : 'ltr';
}

/**
 * Check if current locale is RTL
 */
export function isRTL(locale: string): boolean {
  return getTextDirection(locale) === 'rtl';
}

/**
 * Get CSS class for RTL-aware spacing
 * Use this for margins and paddings that should flip in RTL
 */
export function getRTLClass(locale: string, ltrClass: string, rtlClass: string): string {
  return isRTL(locale) ? rtlClass : ltrClass;
}

/**
 * Get direction-aware margin/padding classes
 * Example: getRTLSpacing('ar', 'ml-4') returns 'mr-4' for RTL
 */
export function getRTLSpacing(locale: string, className: string): string {
  if (!isRTL(locale)) return className;

  // Map LTR classes to RTL equivalents
  const rtlMap: Record<string, string> = {
    // Margins
    'ml-': 'mr-',
    'mr-': 'ml-',
    'pl-': 'pr-',
    'pr-': 'pl-',
    'left-': 'right-',
    'right-': 'left-',
    'rounded-l': 'rounded-r',
    'rounded-r': 'rounded-l',
    'border-l': 'border-r',
    'border-r': 'border-l',
  };

  let result = className;
  Object.entries(rtlMap).forEach(([ltr, rtl]) => {
    if (className.includes(ltr)) {
      result = className.replace(ltr, rtl);
    }
  });

  return result;
}

/**
 * Get flex direction based on locale
 */
export function getFlexDirection(locale: string, defaultDirection: 'row' | 'row-reverse' = 'row'): string {
  if (defaultDirection === 'row' && isRTL(locale)) {
    return 'row-reverse';
  }
  return defaultDirection;
}

/**
 * Get text alignment based on locale
 */
export function getTextAlign(locale: string, defaultAlign: 'left' | 'right' | 'center' = 'left'): string {
  if (defaultAlign === 'left' && isRTL(locale)) return 'right';
  if (defaultAlign === 'right' && isRTL(locale)) return 'left';
  return defaultAlign;
}

/**
 * Apply RTL transform to numeric values
 * Useful for absolute positioning
 */
export function getRTLPosition(locale: string, position: number): number {
  return isRTL(locale) ? -position : position;
}

/**
 * Get icon rotation for RTL (some icons need flipping)
 */
export function shouldFlipIcon(iconName: string): boolean {
  const iconsToFlip = [
    'arrow-right',
    'arrow-left',
    'chevron-right',
    'chevron-left',
    'caret-right',
    'caret-left',
    'forward',
    'back',
    'undo',
    'redo',
  ];

  return iconsToFlip.some(name => iconName.toLowerCase().includes(name));
}

/**
 * Get CSS transform for icon flipping in RTL
 */
export function getIconTransform(locale: string, iconName: string): string {
  if (isRTL(locale) && shouldFlipIcon(iconName)) {
    return 'scaleX(-1)';
  }
  return '';
}

/**
 * Format number with locale-aware directionality
 * Arabic uses Eastern Arabic numerals in some regions
 */
export function formatNumber(locale: string, value: number): string {
  return new Intl.NumberFormat(locale).format(value);
}

/**
 * Format currency with locale-aware directionality
 */
export function formatCurrency(locale: string, value: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency,
  }).format(value);
}

/**
 * Get table column alignment based on data type and locale
 */
export function getColumnAlign(locale: string, dataType: 'text' | 'number' | 'date' = 'text'): 'left' | 'right' | 'center' {
  if (dataType === 'number') return 'right'; // Numbers align right in all locales
  if (dataType === 'date') return 'center'; // Dates centered
  return isRTL(locale) ? 'right' : 'left'; // Text follows locale direction
}

/**
 * CSS-in-JS helper for RTL-aware styles
 */
export function rtlStyle(locale: string, ltrStyles: Record<string, any>, rtlStyles: Record<string, any> = {}) {
  return isRTL(locale) ? { ...ltrStyles, ...rtlStyles } : ltrStyles;
}

/**
 * Get sort icon direction based on locale
 */
export function getSortIconRotation(locale: string): string {
  return isRTL(locale) ? 'rotate-180' : '';
}
