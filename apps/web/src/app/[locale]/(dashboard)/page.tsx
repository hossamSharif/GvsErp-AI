'use client';

/**
 * Dashboard Home Page
 *
 * Main dashboard with overview widgets and quick actions.
 */

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useAuth } from '@/providers/auth-provider';
import { useDirection } from '@/stores/language-store';
import { cn } from '@/lib/utils';
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
  const { currentUser } = useAuth();
  const { isRtl } = useDirection();
  const params = useParams();
  const locale = params.locale as string;

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">
          Welcome back, {currentUser?.full_name?.split(' ')[0] || 'User'}
        </h1>
        <p className="text-muted-foreground">
          Here&apos;s what&apos;s happening with your business today.
        </p>
      </div>

      {/* Getting Started Guide */}
      <div className="bg-card rounded-lg border p-6">
        <h2 className="text-lg font-semibold mb-4">Get Started</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Set up your business in a few steps. Complete these actions to start managing your operations.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <QuickActionButton
            icon={<Box className="w-5 h-5" />}
            label="Add Your First Product"
            description="Define items, prices, and stock"
            href={`/${locale}/items/new`}
          />
          <QuickActionButton
            icon={<Users className="w-5 h-5" />}
            label="Add a Customer"
            description="Track sales and balances"
            href={`/${locale}/customers`}
          />
          <QuickActionButton
            icon={<FileText className="w-5 h-5" />}
            label="Create an Invoice"
            description="Start processing sales"
            href={`/${locale}/sales/new`}
          />
          <QuickActionButton
            icon={<DollarSign className="w-5 h-5" />}
            label="Record a Payment"
            description="Track money in and out"
            href={`/${locale}/payments/new`}
          />
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Activity */}
        <div className="bg-card rounded-lg border p-6">
          <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Activity className="w-12 h-12 mb-4 opacity-50" />
            <p className="text-sm">No recent activity</p>
            <p className="text-xs">Your recent transactions will appear here</p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-card rounded-lg border p-6">
          <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <QuickActionButton
              icon={<Plus className="w-5 h-5" />}
              label="New Sale"
              href={`/${locale}/sales/new`}
            />
            <QuickActionButton
              icon={<Plus className="w-5 h-5" />}
              label="New Purchase"
              href={`/${locale}/purchases/new`}
            />
            <QuickActionButton
              icon={<Box className="w-5 h-5" />}
              label="Manage Items"
              href={`/${locale}/items`}
            />
            <QuickActionButton
              icon={<BarChart3 className="w-5 h-5" />}
              label="Item Reports"
              href={`/${locale}/items/report`}
            />
          </div>
        </div>
      </div>

      {/* Bottom Section */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Top Products */}
        <div className="bg-card rounded-lg border p-6">
          <h2 className="text-lg font-semibold mb-4">Top Products</h2>
          <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
            <Box className="w-10 h-10 mb-2 opacity-50" />
            <p className="text-sm">No products yet</p>
            <Link href={`/${locale}/items/new`} className="text-xs text-primary hover:underline mt-1">
              Add your first product
            </Link>
          </div>
        </div>

        {/* Recent Invoices */}
        <div className="bg-card rounded-lg border p-6">
          <h2 className="text-lg font-semibold mb-4">Recent Invoices</h2>
          <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
            <FileText className="w-10 h-10 mb-2 opacity-50" />
            <p className="text-sm">No invoices yet</p>
            <Link href={`/${locale}/sales/new`} className="text-xs text-primary hover:underline mt-1">
              Create your first invoice
            </Link>
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div className="bg-card rounded-lg border p-6">
          <h2 className="text-lg font-semibold mb-4">Low Stock Alerts</h2>
          <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
            <AlertTriangle className="w-10 h-10 mb-2 opacity-50" />
            <p className="text-sm">No alerts</p>
            <Link href={`/${locale}/warehouses`} className="text-xs text-primary hover:underline mt-1">
              Configure stock alerts
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

// Stats Card Component
interface StatsCardProps {
  title: string;
  value: string;
  change: string;
  changeType: 'positive' | 'negative' | 'neutral';
  icon: React.ReactNode;
}

function StatsCard({ title, value, change, changeType, icon }: StatsCardProps) {
  return (
    <div className="bg-card rounded-lg border p-6">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-muted-foreground">{title}</span>
        <span className="p-2 bg-muted rounded-md">{icon}</span>
      </div>
      <div className="space-y-1">
        <p className="text-2xl font-bold">{value}</p>
        <p
          className={cn(
            'text-xs',
            changeType === 'positive' && 'text-green-600',
            changeType === 'negative' && 'text-red-600',
            changeType === 'neutral' && 'text-muted-foreground'
          )}
        >
          {change} from last month
        </p>
      </div>
    </div>
  );
}

// Quick Action Button Component
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

