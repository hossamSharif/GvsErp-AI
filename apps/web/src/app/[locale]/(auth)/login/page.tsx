'use client';

/**
 * Login Page
 *
 * User authentication form.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/providers/auth-provider';
import { isLocalMode } from '@/lib/runtime-config';
import { useSetupStatus } from '@/hooks/use-setup-status';
import { IDLE_SIGN_OUT_KEY } from '@/hooks/use-idle-sign-out';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { signIn } = useAuth();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const locale = params.locale as string;
  const t = useTranslations('auth');
  const tLocal = useTranslations('local');
  const resetSuccess = searchParams.get('reset') === 'success';
  // Set by useIdleSignOut (local edition) just before an automatic sign-out.
  const [idleMinutes, setIdleMinutes] = useState<string | null>(null);
  useEffect(() => {
    try {
      const v = sessionStorage.getItem(IDLE_SIGN_OUT_KEY);
      if (v) {
        setIdleMinutes(v);
        sessionStorage.removeItem(IDLE_SIGN_OUT_KEY);
      }
    } catch {
      // storage unavailable: no notice
    }
  }, []);
  const local = isLocalMode();
  const setup = useSetupStatus();

  // Local edition: a brand-new install goes straight to the one-time setup.
  useEffect(() => {
    if (setup === 'needs-setup') router.replace(`/${locale}/register`);
  }, [setup, router, locale]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await signIn(email, password);
      router.push(`/${locale}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('loginFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold">{t('welcomeBack')}</h1>
        <p className="text-muted-foreground">{t('signInSubtitle')}</p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {idleMinutes && !error && (
          <div role="status" className="p-3 rounded-md bg-muted text-sm">
            {tLocal('idleSignedOut', { minutes: idleMinutes })}
          </div>
        )}
        {resetSuccess && !error && (
          <div role="status" className="p-3 rounded-md bg-primary/10 text-sm">
            {t('passwordUpdated')}
          </div>
        )}
        {error && (
          <div role="alert" className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
            {error}
          </div>
        )}

        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium">
            {t('email')}
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="w-full px-3 py-2 rounded-md border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder={t('emailPlaceholder')}
            dir="ltr"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="text-sm font-medium">
              {t('password')}
            </label>
            {!local && (
              <Link
                href={`/${locale}/forgot-password`}
                className="text-sm text-primary hover:underline"
              >
                {t('forgotPassword')}
              </Link>
            )}
          </div>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="w-full px-3 py-2 rounded-md border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder={t('passwordPlaceholder')}
            dir="ltr"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-2.5 px-4 rounded-md bg-primary text-primary-foreground font-medium hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? t('signingIn') : t('signIn')}
        </button>

        {local && (
          <p className="text-center text-sm text-muted-foreground">{tLocal('forgotPasswordHint')}</p>
        )}
      </form>
    </div>
  );
}
