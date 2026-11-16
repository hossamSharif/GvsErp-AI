'use client';

/**
 * Settings Overview Page
 *
 * Main settings page with navigation to different settings sections.
 */

import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { isLocalMode } from '@/lib/runtime-config';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Users,
  Shield,
  DollarSign,
  TrendingUp,
  Settings as SettingsIcon,
  CreditCard,
  Globe,
  Palette,
  UserCircle,
  Table2,
  KeyRound,
} from 'lucide-react';

interface SettingsSection {
  title: string;
  description: string;
  icon: React.ReactNode;
  href: string;
  badge?: string;
}

export default function SettingsPage() {
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;
  const t = useTranslations('settings.home');
  const tLicense = useTranslations('local.license');

  const sections: SettingsSection[] = [
    {
      title: t('cards.profile'),
      description: t('cards.profileDesc'),
      icon: <UserCircle className="h-6 w-6" />,
      href: `/${locale}/settings/profile`,
    },
    {
      title: t('cards.general'),
      description: t('cards.generalDesc'),
      icon: <SettingsIcon className="h-6 w-6" />,
      href: `/${locale}/settings/general`,
    },
    {
      title: t('cards.users'),
      description: t('cards.usersDesc'),
      icon: <Users className="h-6 w-6" />,
      href: `/${locale}/settings/users`,
    },
    {
      title: t('cards.roles'),
      description: t('cards.rolesDesc'),
      icon: <Shield className="h-6 w-6" />,
      href: `/${locale}/settings/roles`,
    },
    {
      title: t('cards.currencies'),
      description: t('cards.currenciesDesc'),
      icon: <DollarSign className="h-6 w-6" />,
      href: `/${locale}/settings/currencies`,
    },
    {
      title: t('cards.exchangeRates'),
      description: t('cards.exchangeRatesDesc'),
      icon: <TrendingUp className="h-6 w-6" />,
      href: `/${locale}/settings/exchange-rates`,
    },
    {
      title: t('cards.itemsGrid'),
      description: t('cards.itemsGridDesc'),
      icon: <Table2 className="h-6 w-6" />,
      href: `/${locale}/items/bulk-edit`,
    },
    {
      title: t('cards.subscription'),
      description: t('cards.subscriptionDesc'),
      icon: <CreditCard className="h-6 w-6" />,
      href: `/${locale}/settings/subscription`,
      badge: t('comingSoon'),
    },
    // Local edition only: license key / trial.
    ...(isLocalMode()
      ? [
          {
            title: tLicense('title'),
            description: tLicense('cardDescription'),
            icon: <KeyRound className="h-6 w-6" />,
            href: `/${locale}/settings/license`,
          },
        ]
      : []),
  ].filter(
    // Local edition: no online subscription.
    (section) => !(isLocalMode() && section.href.endsWith('/settings/subscription'))
  );

  const handleNavigate = (href: string) => {
    router.push(href);
  };

  return (
    <div className="flex h-full flex-col space-y-6 p-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground">{t('description')}</p>
      </div>

      {/* Settings Sections Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {sections.map((section) => (
          <Card
            key={section.href}
            className="cursor-pointer transition-colors hover:bg-accent"
            onClick={() => handleNavigate(section.href)}
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-primary/10 p-2 text-primary">
                    {section.icon}
                  </div>
                  <div>
                    <CardTitle className="text-lg">{section.title}</CardTitle>
                    {section.badge && (
                      <span className="mt-1 inline-block rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                        {section.badge}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription>{section.description}</CardDescription>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
