'use client';

/**
 * Reset Password Page
 *
 * Landing page for the link in the password-reset email. Supabase's browser
 * client parses the recovery token from the URL and establishes a temporary
 * session (PASSWORD_RECOVERY event), after which the user can set a new
 * password via supabase.auth.updateUser.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/providers/auth-provider';
import { isLocalMode } from '@/lib/runtime-config';

export default function ResetPasswordPage() {
  // Local edition has no email server: password resets are done by an admin.
  const localRouter = useRouter();
  const localLocale = useParams().locale as string;
  useEffect(() => {
    if (isLocalMode()) localRouter.replace(`/${localLocale}/login`);
  }, [localRouter, localLocale]);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  // Whether we've finished checking for a recovery session.
  const [checked, setChecked] = useState(false);

  const { session, isLoading: authLoading, updatePassword } = useAuth();
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;
  const t = useTranslations('auth');

  // Give the Supabase client a moment to parse the recovery token from the URL
  // before deciding whether the link is valid.
  useEffect(() => {
    if (!authLoading) {
      const timer = setTimeout(() => setChecked(true), 800);
      return () => clearTimeout(timer);
    }
  }, [authLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError(t('passwordsMismatch'));
      return;
    }
    if (password.length < 8) {
      setError(t('passwordTooShort'));
      return;
    }

    setIsLoading(true);
    try {
      await updatePassword(password);
      router.push(`/${locale}/login?reset=success`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('resetRequestFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  // Still verifying the recovery session.
  if (!session && !checked) {
    return (
      <div className="space-y-6 text-center">
        <p className="text-muted-foreground">{t('verifyingResetLink')}</p>
      </div>
    );
  }

  // No recovery session — link is missing, invalid, or expired.
  if (!session) {
    return (
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">{t('resetPasswordTitle')}</h1>
        </div>
        <div role="alert" className="p-3 rounded-md bg-destructive/10 text-destructive text-sm text-center">
          {t('invalidResetLink')}
        </div>
        <p className="text-center text-sm text-muted-foreground">
          <Link
            href={`/${locale}/forgot-password`}
            className="text-primary hover:underline font-medium"
          >
            {t('forgotPasswordTitle')}
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold">{t('resetPasswordTitle')}</h1>
        <p className="text-muted-foreground">{t('resetPasswordSubtitle')}</p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div role="alert" className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
            {error}
          </div>
        )}

        <div className="space-y-2">
          <label htmlFor="password" className="text-sm font-medium">
            {t('newPassword')}
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
            className="w-full px-3 py-2 rounded-md border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder={t('newPasswordPlaceholder')}
            dir="ltr"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="confirmPassword" className="text-sm font-medium">
            {t('confirmNewPassword')}
          </label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            autoComplete="new-password"
            className="w-full px-3 py-2 rounded-md border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder={t('confirmNewPasswordPlaceholder')}
            dir="ltr"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-2.5 px-4 rounded-md bg-primary text-primary-foreground font-medium hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? t('updatingPassword') : t('updatePassword')}
        </button>
      </form>
    </div>
  );
}
