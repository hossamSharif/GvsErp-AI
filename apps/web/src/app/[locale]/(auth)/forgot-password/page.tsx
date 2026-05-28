'use client';

/**
 * Forgot Password Page
 *
 * Collects the user's email and sends a Supabase password-reset link that
 * returns to the /{locale}/reset-password page.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/providers/auth-provider';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const { sendPasswordReset } = useAuth();
  const params = useParams();
  const locale = params.locale as string;
  const t = useTranslations('auth');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const redirectTo = `${window.location.origin}/${locale}/reset-password`;
      await sendPasswordReset(email, redirectTo);
      // Always show the same confirmation, regardless of whether the email
      // is registered, to avoid leaking which accounts exist.
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('resetRequestFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold">{t('forgotPasswordTitle')}</h1>
        <p className="text-muted-foreground">{t('forgotPasswordSubtitle')}</p>
      </div>

      {sent ? (
        <div
          role="status"
          className="p-4 rounded-md bg-primary/10 text-sm text-center space-y-2"
        >
          <p>{t('resetLinkSent')}</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
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

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 px-4 rounded-md bg-primary text-primary-foreground font-medium hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? t('sendingResetLink') : t('sendResetLink')}
          </button>
        </form>
      )}

      {/* Footer */}
      <p className="text-center text-sm text-muted-foreground">
        <Link
          href={`/${locale}/login`}
          className="text-primary hover:underline font-medium"
        >
          {t('backToLogin')}
        </Link>
      </p>
    </div>
  );
}
