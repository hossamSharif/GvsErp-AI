'use client';

/**
 * Reports Hub Page
 *
 * Central dashboard for accessing all business reports.
 * Provides quick access to sales, purchases, inventory, and financial reports.
 */

import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  ShoppingCart,
  Package,
  Warehouse,
  Users,
  Building2,
  Receipt,
  TrendingUp,
  BarChart3,
  PieChart,
  FileText,
  DollarSign,
  AlertTriangle,
  Calendar,
  Download,
  ArrowRight,
} from 'lucide-react';

interface ReportCardProps {
  title: string;
  description: string;
  icon: React.ElementType;
  href: string;
  color: string;
  stats?: string;
}

function ReportCard({ title, description, icon: Icon, href, color, stats }: ReportCardProps) {
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;

  return (
    <Card
      className="group cursor-pointer transition-all hover:shadow-md hover:border-primary/50"
      onClick={() => router.push(`/${locale}${href}`)}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className={`p-2 rounded-lg ${color}`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </CardHeader>
      <CardContent>
        <CardTitle className="text-lg mb-1">{title}</CardTitle>
        <CardDescription className="text-sm">{description}</CardDescription>
        {stats && (
          <p className="text-xs text-muted-foreground mt-2 pt-2 border-t">{stats}</p>
        )}
      </CardContent>
    </Card>
  );
}

export default function ReportsPage() {
  const params = useParams();
  const locale = params.locale as string;
  const t = useTranslations('reports');
  const tCommon = useTranslations('common');

  const reportCategories = [
    {
      title: t('categories.salesRevenue'),
      reports: [
        {
          title: t('sales.title'),
          description: t('sales.description'),
          icon: ShoppingCart,
          href: '/sales',
          color: 'bg-green-500',
          stats: t('sales.viewSalesPerformance'),
        },
        {
          title: t('sales.salesByCustomer.title'),
          description: t('sales.salesByCustomer.description'),
          icon: Users,
          href: '/customers/report',
          color: 'bg-emerald-500',
          stats: t('sales.salesByCustomer.stats'),
        },
        {
          title: t('sales.salesByItem.title'),
          description: t('sales.salesByItem.description'),
          icon: TrendingUp,
          href: '/items/report',
          color: 'bg-teal-500',
          stats: t('sales.salesByItem.stats'),
        },
      ],
    },
    {
      title: t('categories.purchasesCosts'),
      reports: [
        {
          title: t('purchases.title'),
          description: t('purchases.description'),
          icon: Package,
          href: '/purchases',
          color: 'bg-blue-500',
          stats: t('purchases.trackPurchaseOrders'),
        },
        {
          title: t('purchases.purchasesBySupplier.title'),
          description: t('purchases.purchasesBySupplier.description'),
          icon: Building2,
          href: '/suppliers/report',
          color: 'bg-indigo-500',
          stats: t('purchases.purchasesBySupplier.stats'),
        },
      ],
    },
    {
      title: t('categories.inventoryStock'),
      reports: [
        {
          title: t('inventory.title'),
          description: t('inventory.description'),
          icon: Warehouse,
          href: '/warehouses',
          color: 'bg-purple-500',
          stats: t('inventory.stockLevelsValuation'),
        },
        {
          title: t('inventory.lowStockAlerts.title'),
          description: t('inventory.lowStockAlerts.description'),
          icon: AlertTriangle,
          href: '/items?filter=low-stock',
          color: 'bg-amber-500',
          stats: t('inventory.lowStockAlerts.stats'),
        },
        {
          title: t('inventory.itemCategories.title'),
          description: t('inventory.itemCategories.description'),
          icon: PieChart,
          href: '/items/categories',
          color: 'bg-violet-500',
          stats: t('inventory.itemCategories.stats'),
        },
      ],
    },
    {
      title: t('categories.financial'),
      reports: [
        {
          title: t('customerBalances.title'),
          description: t('customerBalances.description'),
          icon: Users,
          href: '/customers?filter=with-balance',
          color: 'bg-rose-500',
          stats: t('customerBalances.stats'),
        },
        {
          title: t('supplierBalances.title'),
          description: t('supplierBalances.description'),
          icon: Building2,
          href: '/suppliers?filter=with-balance',
          color: 'bg-orange-500',
          stats: t('supplierBalances.stats'),
        },
        {
          title: t('paymentsReport.title'),
          description: t('paymentsReport.description'),
          icon: DollarSign,
          href: '/payments/report',
          color: 'bg-cyan-500',
          stats: t('paymentsReport.stats'),
        },
      ],
    },
    {
      title: t('categories.expenses'),
      reports: [
        {
          title: t('expenses.title'),
          description: t('expenses.description'),
          icon: Receipt,
          href: '/expenses',
          color: 'bg-red-500',
          stats: t('expenses.trackBusinessExpenses'),
        },
        {
          title: t('expenses.expensesByCategory.title'),
          description: t('expenses.expensesByCategory.description'),
          icon: BarChart3,
          href: '/expenses/categories',
          color: 'bg-pink-500',
          stats: t('expenses.expensesByCategory.stats'),
        },
      ],
    },
  ];

  return (
    <div className="flex h-full flex-col space-y-6 p-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground">{t('description')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline">
            <Calendar className="me-2 h-4 w-4" />
            {t('dateRange')}
          </Button>
          <Button variant="outline">
            <Download className="me-2 h-4 w-4" />
            {t('export')}
          </Button>
        </div>
      </div>

      {/* Quick Stats Summary */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('quickStats.totalSales')}</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$0.00</div>
            <p className="text-xs text-muted-foreground">{t('quickStats.thisMonth')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('quickStats.totalPurchases')}</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$0.00</div>
            <p className="text-xs text-muted-foreground">{t('quickStats.thisMonth')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('quickStats.totalExpenses')}</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$0.00</div>
            <p className="text-xs text-muted-foreground">{t('quickStats.thisMonth')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('quickStats.netProfit')}</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">$0.00</div>
            <p className="text-xs text-muted-foreground">{t('quickStats.thisMonth')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Report Categories */}
      <div className="space-y-8">
        {reportCategories.map((category, index) => (
          <div key={index} className="space-y-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <FileText className="h-5 w-5 text-muted-foreground" />
              {category.title}
            </h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {category.reports.map((report, reportIndex) => (
                <ReportCard key={reportIndex} {...report} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Accounting Reports (if module enabled) */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-muted-foreground" />
          {t('categories.accounting')}
        </h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <ReportCard
            title={t('accounting.trialBalance.title')}
            description={t('accounting.trialBalance.description')}
            icon={FileText}
            href="/accounting/trial-balance"
            color="bg-slate-500"
            stats={t('accounting.trialBalance.stats')}
          />
          <ReportCard
            title={t('accounting.incomeStatement.title')}
            description={t('accounting.incomeStatement.description')}
            icon={TrendingUp}
            href="/accounting/income-statement"
            color="bg-zinc-500"
            stats={t('accounting.incomeStatement.stats')}
          />
          <ReportCard
            title={t('accounting.balanceSheet.title')}
            description={t('accounting.balanceSheet.description')}
            icon={PieChart}
            href="/accounting/balance-sheet"
            color="bg-neutral-500"
            stats={t('accounting.balanceSheet.stats')}
          />
          <ReportCard
            title={t('accounting.generalLedger.title')}
            description={t('accounting.generalLedger.description')}
            icon={BarChart3}
            href="/accounting/ledger"
            color="bg-stone-500"
            stats={t('accounting.generalLedger.stats')}
          />
          <ReportCard
            title={t('accounting.journalEntries.title')}
            description={t('accounting.journalEntries.description')}
            icon={FileText}
            href="/accounting/journal"
            color="bg-gray-500"
            stats={t('accounting.journalEntries.stats')}
          />
        </div>
      </div>

      {/* HR Reports (if module enabled) */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Users className="h-5 w-5 text-muted-foreground" />
          {t('categories.hr')}
        </h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <ReportCard
            title={t('payroll.title')}
            description={t('payroll.description')}
            icon={DollarSign}
            href="/hr/payroll"
            color="bg-sky-500"
            stats={t('payroll.stats')}
          />
          <ReportCard
            title={t('hr.employeeAttendance.title')}
            description={t('hr.employeeAttendance.description')}
            icon={Calendar}
            href="/hr/attendance"
            color="bg-blue-400"
            stats={t('hr.employeeAttendance.stats')}
          />
          <ReportCard
            title={t('hr.leaveManagement.title')}
            description={t('hr.leaveManagement.description')}
            icon={Calendar}
            href="/hr/leave"
            color="bg-indigo-400"
            stats={t('hr.leaveManagement.stats')}
          />
        </div>
      </div>
    </div>
  );
}
