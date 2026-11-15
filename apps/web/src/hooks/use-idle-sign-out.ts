'use client';

/**
 * Local edition: sign the user out after a period without keyboard, mouse or
 * touch activity, so the next person at a shared PC can't act as them.
 * No-op in the cloud.
 */

import { useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/providers/auth-provider';
import { isLocalMode } from '@/lib/runtime-config';

export const IDLE_SIGN_OUT_MINUTES = 30;

/**
 * sessionStorage key the login page reads to explain an idle sign-out. A URL
 * parameter would be lost: the dashboard's auth guard also redirects to the
 * login page as soon as the session ends.
 */
export const IDLE_SIGN_OUT_KEY = 'gvs:idle-sign-out-minutes';

const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'wheel', 'scroll'] as const;
const CHECK_EVERY_MS = 30_000;

export function useIdleSignOut(minutes: number = IDLE_SIGN_OUT_MINUTES): void {
  const { session, signOut } = useAuth();
  const router = useRouter();
  const locale = useParams().locale as string;
  // signOut is a new function on every AuthProvider render; keep the latest in
  // a ref so re-renders don't restart the idle timer.
  const signOutRef = useRef(signOut);
  signOutRef.current = signOut;
  const hasSession = !!session;

  useEffect(() => {
    if (!isLocalMode() || !hasSession) return;

    const limitMs = minutes * 60_000;
    let lastActivity = Date.now();
    let signingOut = false;

    // Only record a timestamp per event; the interval below does the check,
    // so frequent events like mousemove stay cheap.
    const onActivity = () => {
      lastActivity = Date.now();
    };
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));

    const timer = setInterval(async () => {
      if (signingOut || Date.now() - lastActivity < limitMs) return;
      signingOut = true;
      try {
        sessionStorage.setItem(IDLE_SIGN_OUT_KEY, String(minutes));
      } catch {
        // storage unavailable: sign out anyway, just without the notice
      }
      try {
        await signOutRef.current();
      } finally {
        router.push(`/${locale}/login`);
      }
    }, CHECK_EVERY_MS);

    return () => {
      clearInterval(timer);
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, onActivity));
    };
  }, [hasSession, router, locale, minutes]);
}
