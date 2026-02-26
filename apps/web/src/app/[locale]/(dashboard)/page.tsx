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

export default function DashboardPage() {
  const { user } = useAuth();
  const { isRtl } = useDirection();
  const params = useParams();
  const locale = params.locale as string;

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">
          Welcome back, {user?.full_name?.split(' ')[0] || 'User'}
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
            icon={<BoxIcon className="w-5 h-5" />}
            label="Add Your First Product"
            description="Define items, prices, and stock"
            href={`/${locale}/items/new`}
          />
          <QuickActionButton
            icon={<UsersIcon className="w-5 h-5" />}
            label="Add a Customer"
            description="Track sales and balances"
            href={`/${locale}/customers`}
          />
          <QuickActionButton
            icon={<FileTextIcon className="w-5 h-5" />}
            label="Create an Invoice"
            description="Start processing sales"
            href={`/${locale}/sales/new`}
          />
          <QuickActionButton
            icon={<DollarIcon className="w-5 h-5" />}
            label="Record a Payment"
            description="Track money in and out"
            href={`/${locale}/payments`}
          />
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Activity */}
        <div className="bg-card rounded-lg border p-6">
          <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <ActivityIcon className="w-12 h-12 mb-4 opacity-50" />
            <p className="text-sm">No recent activity</p>
            <p className="text-xs">Your recent transactions will appear here</p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-card rounded-lg border p-6">
          <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <QuickActionButton
              icon={<PlusIcon className="w-5 h-5" />}
              label="New Sale"
              href={`/${locale}/sales/new`}
            />
            <QuickActionButton
              icon={<PlusIcon className="w-5 h-5" />}
              label="New Purchase"
              href={`/${locale}/purchases/new`}
            />
            <QuickActionButton
              icon={<BoxIcon className="w-5 h-5" />}
              label="Manage Items"
              href={`/${locale}/items`}
            />
            <QuickActionButton
              icon={<ChartIcon className="w-5 h-5" />}
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
            <BoxIcon className="w-10 h-10 mb-2 opacity-50" />
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
            <FileTextIcon className="w-10 h-10 mb-2 opacity-50" />
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
            <AlertIcon className="w-10 h-10 mb-2 opacity-50" />
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
      className="flex items-center gap-3 p-3 rounded-md border hover:bg-muted transition-colors text-start"
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

// Icon Components
function DollarIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="12" x2="12" y1="2" y2="22" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );
}

function FileTextIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" x2="8" y1="13" y2="13" />
      <line x1="16" x2="8" y1="17" y2="17" />
      <line x1="10" x2="8" y1="9" y2="9" />
    </svg>
  );
}

function BoxIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      <path d="m3.3 7 8.7 5 8.7-5" />
      <path d="M12 22V12" />
    </svg>
  );
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function ActivityIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  );
}

function ChartIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="12" x2="12" y1="20" y2="10" />
      <line x1="18" x2="18" y1="20" y2="4" />
      <line x1="6" x2="6" y1="20" y2="16" />
    </svg>
  );
}

function AlertIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}
