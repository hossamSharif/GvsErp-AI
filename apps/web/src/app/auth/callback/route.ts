/**
 * OAuth Callback Handler
 *
 * Handles OAuth provider callbacks and exchanges code for session.
 */

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next') || '/';

  if (code) {
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: CookieOptions) {
            cookieStore.set({ name, value, ...options });
          },
          remove(name: string, options: CookieOptions) {
            cookieStore.set({ name, value: '', ...options });
          },
        },
      }
    );

    const { data: { session }, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error('OAuth callback error:', error);
      return NextResponse.redirect(new URL('/login?error=oauth_failed', requestUrl.origin));
    }

    if (session) {
      // Check if user has a tenant - if not, redirect to onboarding
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

      try {
        const response = await fetch(`${apiUrl}/auth/me`, {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (!response.ok) {
          // User profile doesn't exist yet - redirect to onboarding
          return NextResponse.redirect(new URL('/onboarding', requestUrl.origin));
        }

        const data = await response.json();

        if (!data.data?.tenant) {
          // User exists but no tenant - redirect to onboarding
          return NextResponse.redirect(new URL('/onboarding', requestUrl.origin));
        }

        // User is fully set up - redirect to dashboard
        return NextResponse.redirect(new URL(next, requestUrl.origin));
      } catch (err) {
        console.error('Error checking user profile:', err);
        // On error, redirect to onboarding to be safe
        return NextResponse.redirect(new URL('/onboarding', requestUrl.origin));
      }
    }
  }

  // No code or session - redirect to login
  return NextResponse.redirect(new URL('/login', requestUrl.origin));
}
