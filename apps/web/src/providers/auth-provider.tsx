'use client';

/**
 * Supabase Auth Provider
 *
 * Provides authentication context and session management.
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { getSupabaseAnonKey, getSupabaseUrl } from '@/lib/runtime-config';
import type { Session, User, AuthChangeEvent } from '@supabase/supabase-js';
import type { CurrentUser } from '@erp/shared';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  currentUser: CurrentUser | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, tenantName: string, fullName?: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
  sendPasswordReset: (email: string, redirectTo?: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // One client for the provider's lifetime (it was re-created on every render).
  const [supabase] = useState(() =>
    createBrowserClient(getSupabaseUrl(), getSupabaseAnonKey())
  );

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          await fetchCurrentUser(session.access_token);
        }
      } catch (error) {
        console.error('Error getting session:', error);
      } finally {
        setIsLoading(false);
      }
    };

    getInitialSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (event === 'SIGNED_IN' && session?.access_token) {
          await fetchCurrentUser(session.access_token);
        } else if (event === 'SIGNED_OUT') {
          setCurrentUser(null);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const fetchCurrentUser = async (accessToken: string) => {
    try {
      const response = await fetch('/api/v1/auth/me', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setCurrentUser(data.data);

        // Snapshot identity for offline recognition (best-effort, browser-only).
        const cu = data.data as { id?: string; tenant_id?: string; email?: string } | null;
        if (cu?.id) {
          try {
            const { saveOfflineIdentity } = await import('@/lib/offline/auth-local');
            await saveOfflineIdentity({
              userId: cu.id,
              tenantId: cu.tenant_id ?? '',
              email: cu.email ?? '',
              currentUser: cu,
            });
          } catch (e) {
            console.warn('[offline] failed to save offline identity', e);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching current user:', error);
    }
  };

  const signIn = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }
    } finally {
      setIsLoading(false);
    }
  };

  const signUp = async (
    email: string,
    password: string,
    tenantName: string,
    fullName?: string
  ) => {
    setIsLoading(true);
    try {
      // Call our API to create tenant and user
      const response = await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
          tenant_name: tenantName,
          full_name: fullName,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Registration failed');
      }

      // Sign in after registration
      await signIn(email, password);
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        // The session may already be invalid (e.g. tokens were revoked after a
        // password change). A global sign-out hits the server with the dead
        // refresh token and fails — fall back to clearing the local session so
        // logout always succeeds.
        console.warn('Global sign-out failed, clearing local session:', error.message);
        await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
      }
    } catch (error) {
      console.warn('Sign-out threw, clearing local session:', error);
      await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
    } finally {
      // Clear the offline identity so the PIN gate resets for the next user.
      // Cached business data is left intact (and wiped on a different-user
      // login) so any not-yet-synced changes survive an accidental sign-out.
      try {
        const { clearOfflineIdentity } = await import('@/lib/offline/auth-local');
        await clearOfflineIdentity();
      } catch {
        /* best-effort */
      }
      // Always clear client state regardless of server outcome.
      setCurrentUser(null);
      setSession(null);
      setUser(null);
      setIsLoading(false);
    }
  };

  const refreshSession = async () => {
    const { data: { session } } = await supabase.auth.refreshSession();
    setSession(session);
    setUser(session?.user ?? null);
    if (session?.access_token) {
      await fetchCurrentUser(session.access_token);
    }
  };

  // Send a password-reset email. The redirectTo URL is where the user lands
  // after clicking the link in the email (our /{locale}/reset-password page).
  const sendPasswordReset = async (email: string, redirectTo?: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(
      email,
      redirectTo ? { redirectTo } : undefined
    );
    if (error) {
      throw error;
    }
  };

  // Set a new password for the current (recovery) session.
  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        currentUser,
        isLoading,
        signIn,
        signUp,
        signOut,
        refreshSession,
        sendPasswordReset,
        updatePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
