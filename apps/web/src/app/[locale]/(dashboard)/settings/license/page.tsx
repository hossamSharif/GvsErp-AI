'use client';

/**
 * Settings → License (local edition only).
 * Shows the license / trial status and this PC's ID, and lets an admin
 * activate a new license key.
 */

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Copy, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/providers/auth-provider';
import { isLocalMode } from '@/lib/runtime-config';
import { useInstallLicense, useLicenseStatus } from '@/hooks/use-license';
import { canManageLicense } from '@/components/license/license-banner';
import { cn } from '@/lib/utils';

function formatDate(iso: string | null, locale: string): string | null {
  return iso ? new Date(iso).toLocaleDateString(locale === 'ar' ? 'ar' : 'en-GB') : null;
}

export default function LicensePage() {
  const t = useTranslations('local.license');
  const router = useRouter();
  const locale = useParams().locale as string;
  const { toast } = useToast();
  const { currentUser } = useAuth();
  const { data: status, isLoading } = useLicenseStatus();
  const install = useInstallLicense();
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const canManage = canManageLicense(currentUser?.role?.permissions);

  // Cloud: there is no license page.
  useEffect(() => {
    if (!isLocalMode()) router.replace(`/${locale}/settings`);
  }, [router, locale]);

  const activate = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    install.mutate(key, {
      onSuccess: () => {
        setKey('');
        toast({ title: t('installed') });
      },
      onError: (err) => setError(err.message),
    });
  };

  const copyPcId = async () => {
    if (!status?.machineId) return;
    try {
      await navigator.clipboard.writeText(status.machineId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard blocked: the ID is selectable on screen
    }
  };

  const rows: Array<[string, string | null]> = status
    ? [
        [t('client'), status.client],
        [t('users'), `${status.usersUsed} / ${status.maxUsers}`],
        status.state === 'trial' || status.state === 'trial_expired'
          ? [t('trialEnds'), formatDate(status.trialEndsAt, locale)]
          : [t('expires'), status.expiresAt ? formatDate(status.expiresAt, locale) : status.client ? t('never') : null],
      ]
    : [];

  return (
    <div className="flex h-full flex-col space-y-6 p-4 md:p-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push(`/${locale}/settings`)}>
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
      </div>

      {status?.testKey && (
        <div role="alert" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          {t('testKeyWarning')}
        </div>
      )}

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            {isLoading || !status ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <span
                className={cn(
                  'rounded-full px-3 py-1 text-sm font-medium',
                  status.canWrite ? 'bg-green-100 text-green-800' : 'bg-destructive/10 text-destructive'
                )}
              >
                {t(`states.${status.state}`)}
                {status.daysLeft !== null && status.canWrite ? ` · ${status.daysLeft}` : ''}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid grid-cols-[auto,1fr] gap-x-6 gap-y-2 text-sm">
            {rows
              .filter(([, v]) => v)
              .map(([label, value]) => (
                <div key={label} className="contents">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="font-medium">{value}</dd>
                </div>
              ))}
          </dl>

          <div className="space-y-1 rounded-md bg-muted p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-muted-foreground">{t('pcId')}</span>
              <Button variant="outline" size="sm" onClick={copyPcId} disabled={!status?.machineId}>
                {copied ? <Check className="me-1 h-4 w-4" /> : <Copy className="me-1 h-4 w-4" />}
                {copied ? t('copied') : t('copy')}
              </Button>
            </div>
            <p className="select-all font-mono text-lg tracking-wider" dir="ltr" data-testid="pc-id">
              {status?.machineId ?? '—'}
            </p>
            <p className="text-xs text-muted-foreground">{t('pcIdHint')}</p>
          </div>
        </CardContent>
      </Card>

      <Card className="max-w-2xl">
        <CardContent className="pt-6">
          {canManage ? (
            <form onSubmit={activate} className="space-y-3">
              <Label htmlFor="license-key">{t('keyLabel')}</Label>
              <Textarea
                id="license-key"
                dir="ltr"
                rows={4}
                className="font-mono text-xs"
                placeholder={t('keyPlaceholder')}
                value={key}
                onChange={(e) => setKey(e.target.value)}
              />
              {error && (
                <div role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}
              <Button type="submit" disabled={!key.trim() || install.isPending}>
                {install.isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                {install.isPending ? t('installing') : t('install')}
              </Button>
            </form>
          ) : (
            <p className="text-sm text-muted-foreground">{t('adminOnly')}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
