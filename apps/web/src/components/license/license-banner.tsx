'use client';

/**
 * Local edition: license banner under the header.
 * - running trial / licence expiring within 14 days → info
 * - read-only (trial over, expired, invalid, other PC, clock) → red
 * Renders nothing in the cloud or when the license is fine.
 */

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/providers/auth-provider';
import { useLicenseStatus } from '@/hooks/use-license';
import { cn } from '@/lib/utils';

const EXPIRY_WARNING_DAYS = 14;

export function canManageLicense(permissions: unknown): boolean {
  return Array.isArray(permissions) && (permissions.includes('*') || permissions.includes('settings:write'));
}

export function LicenseBanner() {
  const t = useTranslations('local.license');
  const locale = useParams().locale as string;
  const { currentUser } = useAuth();
  const { data: status } = useLicenseStatus();
  if (!status) return null;

  let tone: 'info' | 'danger' | null = null;
  let text = '';
  if (!status.canWrite) {
    tone = 'danger';
    text = t('bannerReadOnly', { state: t(`states.${status.state}`) });
  } else if (status.state === 'trial') {
    tone = 'info';
    text = t('bannerTrial', { days: status.daysLeft ?? 0 });
  } else if (status.daysLeft !== null && status.daysLeft <= EXPIRY_WARNING_DAYS) {
    tone = 'info';
    text = t('bannerExpiring', { days: status.daysLeft });
  }
  if (!tone) return null;

  const showLink = canManageLicense(currentUser?.role?.permissions);

  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn(
        'flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2 text-sm',
        tone === 'danger'
          ? 'bg-destructive/10 text-destructive'
          : 'bg-primary/10 text-foreground'
      )}
    >
      <span>{text}</span>
      {showLink && (
        <Link href={`/${locale}/settings/license`} className="font-medium underline underline-offset-2">
          {t('enterKeyLink')}
        </Link>
      )}
    </div>
  );
}
