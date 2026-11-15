'use client';

/**
 * Register Page
 *
 * New tenant registration form with organization setup.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/providers/auth-provider';
import { isLocalMode } from '@/lib/runtime-config';
import { useSetupStatus } from '@/hooks/use-setup-status';

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    tenantName: '',
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { signUp } = useAuth();
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;
  const tLocal = useTranslations('local');
  const t = useTranslations('auth');
  const local = isLocalMode();
  const setup = useSetupStatus();

  // Local edition: registering is the one-time setup. Once the company
  // exists, staff accounts are created by an admin, so send people to login.
  useEffect(() => {
    if (local && setup === 'ready') router.replace(`/${locale}/login`);
  }, [local, setup, router, locale]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (formData.password !== formData.confirmPassword) {
      setError(t('passwordsMismatch'));
      return;
    }

    if (formData.password.length < 8) {
      setError(t('passwordTooShort'));
      return;
    }

    setIsLoading(true);

    try {
      await signUp(
        formData.email,
        formData.password,
        formData.tenantName,
        formData.fullName
      );
      router.push(`/${locale}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold">
          {local ? tLocal('setupTitle') : 'Create your account'}
        </h1>
        <p className="text-muted-foreground">
          {local ? tLocal('setupSubtitle') : 'Start your free trial - no credit card required'}
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div role="alert" className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
            {error}
          </div>
        )}

        <div className="space-y-2">
          <label htmlFor="tenantName" className="text-sm font-medium">
            {t('organizationName')}
          </label>
          <input
            id="tenantName"
            name="tenantName"
            type="text"
            value={formData.tenantName}
            onChange={handleChange}
            required
            className="w-full px-3 py-2 rounded-md border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder={t('organizationNamePlaceholder')}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="fullName" className="text-sm font-medium">
            {t('fullName')}
          </label>
          <input
            id="fullName"
            name="fullName"
            type="text"
            value={formData.fullName}
            onChange={handleChange}
            className="w-full px-3 py-2 rounded-md border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder={t('fullNamePlaceholder')}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium">
            {t('email')}
          </label>
          <input
            id="email"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
            required
            autoComplete="email"
            className="w-full px-3 py-2 rounded-md border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder={t('emailPlaceholder')}
            dir="ltr"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="password" className="text-sm font-medium">
            {t('password')}
          </label>
          <input
            id="password"
            name="password"
            type="password"
            value={formData.password}
            onChange={handleChange}
            required
            autoComplete="new-password"
            className="w-full px-3 py-2 rounded-md border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder={t('newAccountPasswordPlaceholder')}
            dir="ltr"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="confirmPassword" className="text-sm font-medium">
            {t('confirmPassword')}
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            value={formData.confirmPassword}
            onChange={handleChange}
            required
            autoComplete="new-password"
            className="w-full px-3 py-2 rounded-md border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder={t('repeatPasswordPlaceholder')}
            dir="ltr"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-2.5 px-4 rounded-md bg-primary text-primary-foreground font-medium hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? t('creatingAccount') : t('createAccount')}
        </button>
      </form>

      {/* Terms (cloud only: the local edition has no online service terms) */}
      {!local && (
      <p className="text-center text-xs text-muted-foreground">
        By creating an account, you agree to our{' '}
        <Link href={`/${locale}/terms`} className="text-primary hover:underline">
          Terms of Service
        </Link>{' '}
        and{' '}
        <Link href={`/${locale}/privacy`} className="text-primary hover:underline">
          Privacy Policy
        </Link>
      </p>
      )}

      {/* Footer */}
      {!local && (
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link
          href={`/${locale}/login`}
          className="text-primary hover:underline font-medium"
        >
          Sign in
        </Link>
      </p>
      )}
    </div>
  );
}
