'use client';

/**
 * Settings Overview Page
 *
 * Main settings page with navigation to different settings sections.
 */

import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
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
} from 'lucide-react';

interface SettingsSection {
  titleKey: string;
  descriptionKey: string;
  icon: React.ReactNode;
  href: string;
  badge?: string;
}

export default function SettingsPage() {
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;
  const t = useTranslations('settings');
  const tCommon = useTranslations('common');

  const sections: SettingsSection[] = [
    {
      titleKey: 'general.title',
      descriptionKey: 'general.description',
      icon: <SettingsIcon className="h-6 w-6" />,
      href: `/${locale}/settings/general`,
    },
    {
      titleKey: 'users.title',
      descriptionKey: 'users.description',
      icon: <Users className="h-6 w-6" />,
      href: `/${locale}/settings/users`,
    },
    {
      titleKey: 'roles.title',
      descriptionKey: 'roles.description',
      icon: <Shield className="h-6 w-6" />,
      href: `/${locale}/settings/roles`,
    },
    {
      titleKey: 'currencies.title',
      descriptionKey: 'currencies.description',
      icon: <DollarSign className="h-6 w-6" />,
      href: `/${locale}/settings/currencies`,
    },
    {
      titleKey: 'exchangeRates.title',
      descriptionKey: 'exchangeRates.description',
      icon: <TrendingUp className="h-6 w-6" />,
      href: `/${locale}/settings/exchange-rates`,
    },
    {
      titleKey: 'subscription.title',
      descriptionKey: 'subscription.description',
      icon: <CreditCard className="h-6 w-6" />,
      href: `/${locale}/settings/subscription`,
    },
  ];

  const handleNavigate = (href: string) => {
    router.push(href);
  };

  return (
    <div className="flex h-full flex-col space-y-6 p-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground">
          {t('description')}
        </p>
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
                    <CardTitle className="text-lg">{t(section.titleKey)}</CardTitle>
                    {section.badge && (
                      <span className="mt-1 inline-block rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                        {tCommon(section.badge)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription>{t(section.descriptionKey)}</CardDescription>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
