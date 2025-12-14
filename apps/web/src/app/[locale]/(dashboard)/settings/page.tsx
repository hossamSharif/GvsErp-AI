'use client';

/**
 * Settings Overview Page
 *
 * Main settings page with navigation to different settings sections.
 */

import { useRouter, useParams } from 'next/navigation';
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

  const sections: SettingsSection[] = [
    {
      title: 'General Settings',
      description: 'Configure language, theme, and display preferences',
      icon: <SettingsIcon className="h-6 w-6" />,
      href: `/${locale}/settings/general`,
    },
    {
      title: 'Users',
      description: 'Manage user accounts and permissions',
      icon: <Users className="h-6 w-6" />,
      href: `/${locale}/settings/users`,
    },
    {
      title: 'Roles & Permissions',
      description: 'Configure roles and access control',
      icon: <Shield className="h-6 w-6" />,
      href: `/${locale}/settings/roles`,
    },
    {
      title: 'Currencies',
      description: 'Manage currencies and default settings',
      icon: <DollarSign className="h-6 w-6" />,
      href: `/${locale}/settings/currencies`,
    },
    {
      title: 'Exchange Rates',
      description: 'Set up and manage currency exchange rates',
      icon: <TrendingUp className="h-6 w-6" />,
      href: `/${locale}/settings/exchange-rates`,
    },
    {
      title: 'Subscription & Billing',
      description: 'View your plan and manage billing',
      icon: <CreditCard className="h-6 w-6" />,
      href: `/${locale}/settings/subscription`,
      badge: 'Coming Soon',
    },
  ];

  const handleNavigate = (href: string) => {
    router.push(href);
  };

  return (
    <div className="flex h-full flex-col space-y-6 p-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your system configuration and preferences
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
