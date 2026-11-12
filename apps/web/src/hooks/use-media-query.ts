'use client';

import { useEffect, useState } from 'react';

/**
 * Tracks a CSS media query. Returns false on the server and the first client
 * render so hydration never mismatches; the real value lands right after mount.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(query);
    setMatches(mql.matches);
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

/** True below Tailwind's `md` breakpoint (768px) — phones and small tablets. */
export function useIsMobile(): boolean {
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  // Until mounted we don't know the width; report desktop so SSR markup matches.
  return mounted && !isDesktop;
}
