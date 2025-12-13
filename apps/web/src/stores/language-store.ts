/**
 * Language Store
 *
 * Zustand store for language/locale management with RTL support.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { type Locale, locales, defaultLocale, isRtlLocale } from '@/i18n/config';

interface LanguageState {
  locale: Locale;
  direction: 'ltr' | 'rtl';
  setLocale: (locale: Locale) => void;
}

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set) => ({
      locale: defaultLocale,
      direction: 'ltr',
      setLocale: (locale) => {
        const direction = isRtlLocale(locale) ? 'rtl' : 'ltr';
        set({ locale, direction });
        applyDirection(direction);
      },
    }),
    {
      name: 'erp-language',
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        if (state?.direction) {
          applyDirection(state.direction);
        }
      },
    }
  )
);

function applyDirection(direction: 'ltr' | 'rtl') {
  if (typeof window === 'undefined') return;

  const root = document.documentElement;
  root.setAttribute('dir', direction);
  root.setAttribute('lang', useLanguageStore.getState().locale);
}

// Initialize direction on client side
if (typeof window !== 'undefined') {
  const stored = localStorage.getItem('erp-language');
  if (stored) {
    try {
      const { state } = JSON.parse(stored);
      if (state.direction) {
        applyDirection(state.direction);
      }
    } catch {
      applyDirection('ltr');
    }
  }
}

// Helper hook for RTL-aware styling
export function useDirection() {
  const direction = useLanguageStore((state) => state.direction);
  return {
    direction,
    isRtl: direction === 'rtl',
    isLtr: direction === 'ltr',
  };
}

// Helper to get locale from pathname
export function getLocaleFromPathname(pathname: string): Locale {
  const segments = pathname.split('/');
  const potentialLocale = segments[1] as Locale;
  return locales.includes(potentialLocale) ? potentialLocale : defaultLocale;
}
