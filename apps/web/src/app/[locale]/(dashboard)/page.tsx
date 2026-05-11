'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/providers/auth-provider';
import { useLowStockSummary } from '@/hooks/use-warehouses';
import {
  DollarSign,
  FileText,
  Box,
  Users,
  Activity,
  Plus,
  BarChart3,
  AlertTriangle,
} from 'lucide-react';

export default function DashboardPage() {
  const t = useTranslations('dashboard');
  const { currentUser } = useAuth();
  const params = useParams();
  const locale = params.locale as string;
  const { data: alertSummaryResponse } = useLowStockSummary();
  const alertSummary = alertSummaryResponse?.data;

  const firstName = currentUser?.full_name?.split(' ')[0] || 'User';

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">{t('welcome', { name: firstName })}</h1>
        <p className="text-muted-foreground">{t('subtitle')}</p>
      </div>

      <div className="bg-card rounded-lg border p-6">
        <h2 className="text-lg font-semibold mb-4">{t('getStarted.title')}</h2>
        <p className="text-sm text-muted-foreground mb-4">{t('getStarted.description')}</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <QuickActionButton
            icon={<Box className="w-5 h-5" />}
            label={t('getStarted.addProduct')}
            description={t('getStarted.addProductDesc')}
            href={`/${locale}/items/new`}
          />
          <QuickActionButton
            icon={<Users className="w-5 h-5" />}
            label={t('getStarted.addCustomer')}
            description={t('getStarted.addCustomerDesc')}
            href={`/${locale}/customers`}
          />
          <QuickActionButton
            icon={<FileText className="w-5 h-5" />}
            label={t('getStarted.createInvoice')}
            description={t('getStarted.createInvoiceDesc')}
            href={`/${locale}/sales/new`}
          />
          <QuickActionButton
            icon={<DollarSign className="w-5 h-5" />}
            label={t('getStarted.recordPayment')}
            description={t('getStarted.recordPaymentDesc')}
            href={`/${locale}/payments/new`}
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="bg-card rounded-lg border p-6">
          <h2 className="text-lg font-semibold mb-4">{t('recentActivity.title')}</h2>
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Activity className="w-12 h-12 mb-4 opacity-50" />
            <p className="text-sm">{t('recentActivity.empty')}</p>
            <p className="text-xs">{t('recentActivity.emptyDesc')}</p>
          </div>
        </div>

        <div className="bg-card rounded-lg border p-6">
          <h2 className="text-lg font-semibold mb-4">{t('quickActions.title')}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <QuickActionButton
              icon={<Plus className="w-5 h-5" />}
              label={t('quickActions.newSale')}
              href={`/${locale}/sales/new`}
            />
            <QuickActionButton
              icon={<Plus className="w-5 h-5" />}
              label={t('quickActions.newPurchase')}
              href={`/${locale}/purchases/new`}
            />
            <QuickActionButton
              icon={<Box className="w-5 h-5" />}
              label={t('quickActions.manageItems')}
              href={`/${locale}/items`}
            />
            <QuickActionButton
              icon={<BarChart3 className="w-5 h-5" />}
              label={t('quickActions.itemReports')}
              href={`/${locale}/items/report`}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="bg-card rounded-lg border p-6">
          <h2 className="text-lg font-semibold mb-4">{t('topProducts.title')}</h2>
          <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
            <Box className="w-10 h-10 mb-2 opacity-50" />
            <p className="text-sm">{t('topProducts.empty')}</p>
            <Link href={`/${locale}/items/new`} className="text-xs text-primary hover:underline mt-1">
              {t('topProducts.addFirst')}
            </Link>
          </div>
        </div>

        <div className="bg-card rounded-lg border p-6">
          <h2 className="text-lg font-semibold mb-4">{t('recentInvoices.title')}</h2>
          <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
            <FileText className="w-10 h-10 mb-2 opacity-50" />
            <p className="text-sm">{t('recentInvoices.empty')}</p>
            <Link href={`/${locale}/sales/new`} className="text-xs text-primary hover:underline mt-1">
              {t('recentInvoices.createFirst')}
            </Link>
          </div>
        </div>

        <div className="bg-card rounded-lg border p-6">
          <h2 className="text-lg font-semibold mb-4">{t('lowStock.title')}</h2>
          {alertSummary && alertSummary.totalAlerts > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t('lowStock.totalAlerts')}</span>
                <span className="text-lg font-bold">{alertSummary.totalAlerts}</span>
              </div>
              {alertSummary.criticalCount > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-red-600 font-medium">{t('lowStock.critical')}</span>
                  <span className="text-sm font-bold text-red-600">{alertSummary.criticalCount}</span>
                </div>
              )}
              {alertSummary.warningCount > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-yellow-600 font-medium">{t('lowStock.warning')}</span>
                  <span className="text-sm font-bold text-yellow-600">{alertSummary.warningCount}</span>
                </div>
              )}
              {alertSummary.lowCount > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{t('lowStock.low')}</span>
                  <span className="text-sm font-bold">{alertSummary.lowCount}</span>
                </div>
              )}
              <Link
                href={`/${locale}/warehouses`}
                className="text-xs text-primary hover:underline block mt-2"
              >
                {t('lowStock.viewAll')}
              </Link>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
              <AlertTriangle className="w-10 h-10 mb-2 opacity-50" />
              <p className="text-sm">{t('lowStock.empty')}</p>
              <Link href={`/${locale}/warehouses`} className="text-xs text-primary hover:underline mt-1">
                {t('lowStock.configure')}
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface QuickActionButtonProps {
  icon: React.ReactNode;
  label: string;
  href: string;
  description?: string;
}

function QuickActionButton({ icon, label, href, description }: QuickActionButtonProps) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 p-3 rounded-md border hover:bg-muted transition-colors text-start focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <span className="p-2 bg-primary/10 text-primary rounded-md shrink-0">{icon}</span>
      <div className="min-w-0">
        <span className="text-sm font-medium block">{label}</span>
        {description && (
          <span className="text-xs text-muted-foreground block">{description}</span>
        )}
      </div>
    </Link>
  );
}
